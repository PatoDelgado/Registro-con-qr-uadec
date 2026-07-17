const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

function loadDotEnv(filePath = path.join(__dirname, '.env')) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY || 'admin123';
  const providedKey = req.headers['x-admin-key'] || req.query.admin_key;

  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: 'Acceso denegado. Clave de admin inválida.' });
  }

  next();
}

// API Ruta 1: Obtener la lista de visitas activas para el menú desplegable
app.get('/api/visitas', (req, res) => {
  const query = `
    SELECT 
      v.id_visita, 
      v.empresa, 
      v.fecha, 
      v.cupo_maximo,
      COALESCE(COUNT(r.id_registro), 0) AS registrados,
      (v.cupo_maximo - COALESCE(COUNT(r.id_registro), 0)) AS disponibles
    FROM visitas v
    LEFT JOIN registros r ON v.id_visita = r.id_visita
    WHERE v.activo = 1
    GROUP BY v.id_visita, v.empresa, v.fecha, v.cupo_maximo
    ORDER BY v.fecha ASC, v.empresa ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/admin/visitas', requireAdmin, (req, res) => {
  const query = `
    SELECT 
      v.id_visita, 
      v.empresa, 
      v.fecha, 
      v.cupo_maximo,
      v.activo,
      COALESCE(COUNT(r.id_registro), 0) AS registrados,
      (v.cupo_maximo - COALESCE(COUNT(r.id_registro), 0)) AS disponibles
    FROM visitas v
    LEFT JOIN registros r ON v.id_visita = r.id_visita
    GROUP BY v.id_visita, v.empresa, v.fecha, v.cupo_maximo, v.activo
    ORDER BY v.fecha ASC, v.empresa ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/visitas/:id/cupo', (req, res) => {
  const idVisita = req.params.id;

  const queryCupos = `
    SELECT 
      v.cupo_maximo, 
      COUNT(r.id_registro) AS registrados 
    FROM visitas v
    LEFT JOIN registros r ON v.id_visita = r.id_visita
    WHERE v.id_visita = ?
    GROUP BY v.id_visita, v.cupo_maximo
  `;

  db.get(queryCupos, [idVisita], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Visita no encontrada" });
    }
    const disponibles = row.cupo_maximo - row.registrados;
    res.json({ disponibles, cupo_maximo: row.cupo_maximo });
  });
});

// API Ruta 3: Registrar alumno y verificar cupo en tiempo real (Transacción simulada)
app.post('/api/registrar', (req, res) => {
  const { id_visita, matricula, nombre, facultad, carrera } = req.body;

  if (!id_visita || !matricula || !nombre || !facultad || !carrera) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  db.get("SELECT id_registro FROM registros WHERE id_visita = ? AND matricula = ?", [id_visita, matricula], (err, existRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (existRow) {
      return res.status(400).json({ error: "Esta matrícula ya cuenta con un registro para esta visita industrial." });
    }

    db.get("SELECT cupo_maximo FROM visitas WHERE id_visita = ? AND activo = 1", [id_visita], (err, visitaRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!visitaRow) {
        return res.status(404).json({ error: "La visita no existe o está inactiva." });
      }

      db.get("SELECT COUNT(*) AS inscritos FROM registros WHERE id_visita = ?", [id_visita], (err, cupoRow) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (cupoRow.inscritos >= visitaRow.cupo_maximo) {
          return res.status(400).json({ error: "Lo sentimos, el cupo para esta visita se ha agotado." });
        }

        const randomToken = Math.random().toString(36).substring(2, 9).toUpperCase();
        const idRegistro = `REG-UAdeC-${id_visita}-${randomToken}`;
        const insertQuery = `
          INSERT INTO registros (id_registro, id_visita, matricula, nombre, facultad, carrera)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [idRegistro, id_visita, matricula, nombre, facultad, carrera], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.status(201).json({
            success: true,
            id_registro: idRegistro,
            message: "Registro procesado con éxito"
          });
        });
      });
    });
  });
});

app.get('/api/registros', (req, res) => {
  const query = `
    SELECT 
      r.id_registro,
      r.id_visita,
      v.empresa,
      v.fecha,
      r.matricula,
      r.nombre,
      r.facultad,
      r.carrera,
      r.fecha_registro,
      r.asistio
    FROM registros r
    INNER JOIN visitas v ON v.id_visita = r.id_visita
    ORDER BY r.fecha_registro DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/visitas/:id/registros', (req, res) => {
  const idVisita = req.params.id;
  const query = `
    SELECT 
      r.id_registro,
      r.matricula,
      r.nombre,
      r.facultad,
      r.carrera,
      r.fecha_registro,
      r.asistio
    FROM registros r
    WHERE r.id_visita = ?
    ORDER BY r.fecha_registro DESC
  `;

  db.all(query, [idVisita], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/admin/visitas', requireAdmin, (req, res) => {
  const { empresa, fecha, cupo_maximo, activo } = req.body;

  if (!empresa || !fecha || cupo_maximo === undefined) {
    return res.status(400).json({ error: 'empresa, fecha y cupo_maximo son obligatorios.' });
  }

  const query = `
    INSERT INTO visitas (empresa, fecha, cupo_maximo, activo)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [empresa.trim(), fecha.trim(), Number(cupo_maximo), activo ? 1 : 0], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({
      success: true,
      id_visita: this?.insertId,
      message: 'Visita creada con éxito'
    });
  });
});

app.put('/api/admin/visitas/:id', requireAdmin, (req, res) => {
  const idVisita = req.params.id;
  const { empresa, fecha, cupo_maximo, activo } = req.body;

  const fields = [];
  const params = [];

  if (empresa !== undefined) {
    fields.push('empresa = ?');
    params.push(empresa.trim());
  }
  if (fecha !== undefined) {
    fields.push('fecha = ?');
    params.push(fecha.trim());
  }
  if (cupo_maximo !== undefined) {
    fields.push('cupo_maximo = ?');
    params.push(Number(cupo_maximo));
  }
  if (activo !== undefined) {
    fields.push('activo = ?');
    params.push(activo ? 1 : 0);
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'No hay campos para actualizar.' });
  }

  params.push(idVisita);

  const query = `UPDATE visitas SET ${fields.join(', ')} WHERE id_visita = ?`;
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      message: 'Visita actualizada con éxito'
    });
  });
});

app.delete('/api/admin/visitas/:id', requireAdmin, (req, res) => {
  const idVisita = req.params.id;

  db.run('DELETE FROM visitas WHERE id_visita = ?', [idVisita], function(err) {
    if (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          error: 'No se puede eliminar porque tiene registros asociados.'
        });
      }
      return res.status(500).json({ error: err.message });
    }

    res.json({
      success: true,
      message: 'Visita eliminada con éxito'
    });
  });
});

app.get('/api/admin/visitas/:id/excel', requireAdmin, (req, res) => {
  const idVisita = req.params.id;

  const queryVisita = `
    SELECT 
      v.id_visita,
      v.empresa,
      v.fecha,
      v.cupo_maximo,
      v.activo,
      COALESCE(COUNT(r.id_registro), 0) AS registrados,
      (v.cupo_maximo - COALESCE(COUNT(r.id_registro), 0)) AS disponibles
    FROM visitas v
    LEFT JOIN registros r ON v.id_visita = r.id_visita
    WHERE v.id_visita = ?
    GROUP BY v.id_visita, v.empresa, v.fecha, v.cupo_maximo, v.activo
  `;

  const queryRegistros = `
    SELECT 
      r.id_registro,
      r.matricula,
      r.nombre,
      r.facultad,
      r.carrera,
      r.fecha_registro,
      r.asistio
    FROM registros r
    WHERE r.id_visita = ?
    ORDER BY r.fecha_registro DESC
  `;

  db.get(queryVisita, [idVisita], (err, visitaRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!visitaRow) {
      return res.status(404).json({ error: 'Visita no encontrada.' });
    }

    db.all(queryRegistros, [idVisita], (err, registros) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const summaryRows = [
        {
          Campo: 'ID visita',
          Valor: visitaRow.id_visita
        },
        {
          Campo: 'Empresa',
          Valor: visitaRow.empresa
        },
        {
          Campo: 'Fecha',
          Valor: visitaRow.fecha
        },
        {
          Campo: 'Cupo máximo',
          Valor: visitaRow.cupo_maximo
        },
        {
          Campo: 'Registrados',
          Valor: visitaRow.registrados
        },
        {
          Campo: 'Disponibles',
          Valor: visitaRow.disponibles
        },
        {
          Campo: 'Estado',
          Valor: visitaRow.activo ? 'Activa' : 'Inactiva'
        }
      ];

      const worksheetResumen = XLSX.utils.json_to_sheet(summaryRows);
      const worksheetRegistros = XLSX.utils.json_to_sheet(registros);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheetResumen, 'Visita');
      XLSX.utils.book_append_sheet(workbook, worksheetRegistros, 'Registros');

      const fileName = `visita_${visitaRow.id_visita}_${String(visitaRow.empresa).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.xlsx`;
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    });
  });
});

db.ready
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Servidor de la UAdeC corriendo en: http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar el servidor:', err?.message || err);
    process.exit(1);
  });

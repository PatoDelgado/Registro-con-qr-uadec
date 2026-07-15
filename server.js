const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1';

app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Ruta 1: Obtener la lista de visitas activas para el menú desplegable
app.get('/api/visitas', (req, res) => {
  const query = "SELECT id_visita, empresa, fecha, cupo_maximo FROM visitas WHERE activo = 1";
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// API Ruta 2: Obtener cupos restantes para una visita específica
app.get('/api/visitas/:id/cupo', (req, res) => {
  const idVisita = req.params.id;

  const queryCupos = `
    SELECT 
      v.cupo_maximo, 
      COUNT(r.id_registro) AS registrados 
    FROM visitas v
    LEFT JOIN registros r ON v.id_visita = r.id_visita
    WHERE v.id_visita = ?
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

  // Verificar primero si el alumno ya se registró a ESTA visita específica (Prevenir clonaciones)
  db.get("SELECT id_registro FROM registros WHERE id_visita = ? AND matricula = ?", [id_visita, matricula], (err, existRow) => {
    if (existRow) {
      return res.status(400).json({ error: "Esta matrícula ya cuenta con un registro para esta visita industrial." });
    }

    // Verificar cupos en tiempo real
    const checkCupoQuery = `
      SELECT v.cupo_maximo, COUNT(r.id_registro) AS inscritos 
      FROM visitas v
      LEFT JOIN registros r ON v.id_visita = r.id_visita
      WHERE v.id_visita = ?
    `;

    db.get(checkCupoQuery, [id_visita], (err, cupoRow) => {
      if (err) return res.status(500).json({ error: err.message });

      if (cupoRow.inscritos >= cupoRow.cupo_maximo) {
        return res.status(400).json({ error: "Lo sentimos, el cupo para esta visita se ha agotado." });
      }

      // Generar Token Único Seguro para el QR (Formato institucional)
      const randomToken = Math.random().toString(36).substring(2, 9).toUpperCase();
      const idRegistro = `REG-UAdeC-${id_visita}-${randomToken}`;

      // Insertar el nuevo registro
      const insertQuery = `
        INSERT INTO registros (id_registro, id_visita, matricula, nombre, facultad, carrera)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(insertQuery, [idRegistro, id_visita, matricula, nombre, facultad, carrera], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Responder con el Token que usará el QR y datos de confirmación
        res.status(201).json({
          success: true,
          id_registro: idRegistro,
          message: "Registro procesado con éxito"
        });
      });
    });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Servidor de la UAdeC corriendo en: http://${HOST}:${PORT}`);
});

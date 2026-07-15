const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crea o conecta la base de datos en un archivo local
const dbPath = path.resolve(__dirname, 'uadec_visitas.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos SQLite:', err.message);
  } else {
    console.log('Conectado con éxito a la base de datos SQLite local.');
  }
});

// Inicializar tablas esenciales para la UAdeC
db.serialize(() => {
  // 1. Tabla de visitas (fábricas)
  db.run(`
    CREATE TABLE IF NOT EXISTS visitas (
      id_visita INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL,
      fecha TEXT NOT NULL,
      cupo_maximo INTEGER NOT NULL,
      activo INTEGER DEFAULT 1
    )
  `);

  // 2. Tabla de registros de alumnos
  db.run(`
    CREATE TABLE IF NOT EXISTS registros (
      id_registro TEXT PRIMARY KEY,
      id_visita INTEGER,
      matricula TEXT NOT NULL,
      nombre TEXT NOT NULL,
      facultad TEXT NOT NULL,
      carrera TEXT NOT NULL,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      asistio INTEGER DEFAULT 0,
      FOREIGN KEY(id_visita) REFERENCES visitas(id_visita)
    )
  `);

  // Insertar datos de prueba iniciales si la tabla de visitas está vacía
  db.get("SELECT COUNT(*) AS count FROM visitas", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare("INSERT INTO visitas (empresa, fecha, cupo_maximo, activo) VALUES (?, ?, ?, ?)");
      stmt.run("Deacero - Planta Saltillo", "2026-08-15", 5, 1); // Cupo de 5 para probar el llenado fácil
      stmt.run("Magna Assembly - Ramos Arizpe", "2026-08-20", 15, 1);
      stmt.run("Stellantis Derramadero", "2026-08-25", 30, 1);
      stmt.finalize();
      console.log("Visitas de prueba de la UAdeC añadidas a la base de datos.");
    }
  });
});

module.exports = db;
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise();

function initSchema() {
  return db.query(`
    CREATE TABLE IF NOT EXISTS visitas (
      id_visita INT AUTO_INCREMENT PRIMARY KEY,
      empresa VARCHAR(255) NOT NULL,
      fecha VARCHAR(32) NOT NULL,
      cupo_maximo INT NOT NULL,
      activo TINYINT(1) DEFAULT 1
    )
  `).then(() => db.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id_registro VARCHAR(64) PRIMARY KEY,
      id_visita INT NOT NULL,
      matricula VARCHAR(64) NOT NULL,
      nombre VARCHAR(255) NOT NULL,
      facultad VARCHAR(255) NOT NULL,
      carrera VARCHAR(255) NOT NULL,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      asistio TINYINT(1) DEFAULT 0,
      CONSTRAINT fk_registros_visitas
        FOREIGN KEY (id_visita) REFERENCES visitas(id_visita)
        ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `)).then(() => db.query(`
    CREATE INDEX idx_registros_visita_fecha
    ON registros (id_visita, fecha_registro)
  `).catch((err) => {
    if (err && err.code === 'ER_DUP_KEYNAME') {
      return null;
    }
    throw err;
  })).then(() => db.query(`
    CREATE UNIQUE INDEX idx_registros_visita_matricula
    ON registros (id_visita, matricula)
  `).catch((err) => {
    if (err && err.code === 'ER_DUP_KEYNAME') {
      return null;
    }
    throw err;
  }));
}

function seedData() {
  return db.query('SELECT COUNT(*) AS count FROM visitas').then(([rows]) => {
    if (rows[0].count === 0) {
      return db.query(
        'INSERT IGNORE INTO visitas (empresa, fecha, cupo_maximo, activo) VALUES ?',
        [[
          ['Deacero - Planta Saltillo', '2026-08-15', 5, 1],
          ['Magna Assembly - Ramos Arizpe', '2026-08-20', 15, 1],
          ['Stellantis Derramadero', '2026-08-25', 30, 1]
        ]]
      );
    }
    return null;
  });
}

const ready = initSchema()
  .then(seedData)
  .then(() => {
    console.log('Conectado con éxito a la base de datos MySQL.');
  })
  .catch((err) => {
    console.error('Error inicializando MySQL:', err.message);
    process.exitCode = 1;
  });

db.ready = ready;

db.all = (sql, params, cb) => {
  db.query(sql, params)
    .then(([rows]) => cb(null, rows))
    .catch((err) => cb(err));
};

db.get = (sql, params, cb) => {
  db.query(sql, params)
    .then(([rows]) => cb(null, rows[0]))
    .catch((err) => cb(err));
};

db.run = (sql, params, cb) => {
  db.query(sql, params)
    .then(([result]) => cb && cb(null, result))
    .catch((err) => cb && cb(err));
};

module.exports = db;

CREATE DATABASE IF NOT EXISTS uadec_registros
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE uadec_registros;

CREATE TABLE IF NOT EXISTS visitas (
  id_visita INT AUTO_INCREMENT PRIMARY KEY,
  empresa VARCHAR(255) NOT NULL,
  fecha VARCHAR(32) NOT NULL,
  cupo_maximo INT NOT NULL,
  activo TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

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
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_registros_visita_fecha
  ON registros (id_visita, fecha_registro);

CREATE UNIQUE INDEX idx_registros_visita_matricula
  ON registros (id_visita, matricula);

INSERT IGNORE INTO visitas (empresa, fecha, cupo_maximo, activo) VALUES
  ('Deacero - Planta Saltillo', '2026-08-15', 5, 1),
  ('Magna Assembly - Ramos Arizpe', '2026-08-20', 15, 1),
  ('Stellantis Derramadero', '2026-08-25', 30, 1);

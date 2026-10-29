CREATE TABLE IF NOT EXISTS documentos (
    coleccion TEXT NOT NULL,
    id TEXT NOT NULL,
    datos TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (coleccion, id)
);

CREATE TABLE IF NOT EXISTS cuentas (
    uid TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    cuenta_uid TEXT NOT NULL,
    vence INTEGER NOT NULL,
    FOREIGN KEY (cuenta_uid) REFERENCES cuentas(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sesiones_vence ON sesiones(vence);

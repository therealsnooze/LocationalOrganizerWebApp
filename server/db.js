const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DATA_DIR } = require('./config');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    lat         REAL    NOT NULL,
    lng         REAL    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id   INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    original_name TEXT    NOT NULL,
    stored_name   TEXT    NOT NULL UNIQUE,
    mime_type     TEXT    NOT NULL,
    size          INTEGER NOT NULL,
    uploaded_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_files_location ON files(location_id);
`);

module.exports = db;

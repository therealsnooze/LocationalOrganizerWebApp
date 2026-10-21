const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createClient } = require('@libsql/client');
const { DATA_DIR } = require('./config');

// Turso (hosted SQLite) when deployed, a local SQLite file otherwise.
function connect() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: pathToFileURL(path.join(DATA_DIR, 'app.db')).href });
}

const client = connect();

// Deleting a location deletes its files rows explicitly (see routes/locations.js)
// rather than relying on ON DELETE CASCADE, which needs PRAGMA foreign_keys on
// every connection.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
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
`;

async function migrate() {
  await client.executeMultiple(SCHEMA);
  // Databases created before accounts existed have no locations.user_id yet.
  try {
    await client.execute('ALTER TABLE locations ADD COLUMN user_id INTEGER REFERENCES users(id)');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
  await client.execute('CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id)');
}

// Created on first query, and retried on the next one if it fails.
let ready = null;
function init() {
  ready ??= migrate().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

function toObjects({ rows, columns }) {
  return rows.map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]])));
}

async function all(sql, args = []) {
  await init();
  return toObjects(await client.execute({ sql, args }));
}

async function get(sql, args = []) {
  return (await all(sql, args))[0];
}

async function run(sql, args = []) {
  await init();
  const result = await client.execute({ sql, args });
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

// Runs several statements in one transaction.
async function batch(statements) {
  await init();
  await client.batch(statements, 'write');
}

module.exports = { all, get, run, batch };

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { LEGACY_COLORS } = require('./lib/constants');

function openDatabase(file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'assos.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const recolor = db.prepare('UPDATE associations SET color = ? WHERE color = ?');
  for (const [from, to] of Object.entries(LEGACY_COLORS)) recolor.run(to, from);
  return db;
}

module.exports = { openDatabase };

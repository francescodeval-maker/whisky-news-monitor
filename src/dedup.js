const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'seen.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS seen_items (
        id       TEXT PRIMARY KEY,
        source   TEXT,
        title    TEXT,
        url      TEXT,
        seen_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}

function itemId(item) {
  const key = item.url
    ? `${item.source}::${item.url}`
    : `${item.source}::${item.title}`;
  return crypto.createHash('sha1').update(key).digest('hex');
}

function isNew(item) {
  const row = getDb()
    .prepare('SELECT id FROM seen_items WHERE id = ?')
    .get(itemId(item));
  return !row;
}

function markSeen(item) {
  getDb()
    .prepare('INSERT OR IGNORE INTO seen_items (id, source, title, url) VALUES (?, ?, ?, ?)')
    .run(itemId(item), item.source, item.title, item.url);
}

module.exports = { isNew, markSeen };

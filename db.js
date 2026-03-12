const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'rsvp.db'));

// WAL mode: allows concurrent reads during writes, no locking downtime
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    attending TEXT NOT NULL,
    notes TEXT
  )
`);

module.exports = {
  insert(data) {
    const stmt = db.prepare(
      'INSERT INTO rsvps (name, email, attending, notes) VALUES (?, ?, ?, ?)'
    );
    return stmt.run(data.name, data.email || null, data.attending, data.notes || null);
  },
  all() {
    return db.prepare('SELECT * FROM rsvps ORDER BY created_at DESC').all();
  },
  counts() {
    return db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN attending = 'yes' THEN 1 ELSE 0 END) as yes,
        SUM(CASE WHEN attending = 'maybe' THEN 1 ELSE 0 END) as maybe,
        SUM(CASE WHEN attending = 'no' THEN 1 ELSE 0 END) as no
      FROM rsvps
    `).get();
  }
};

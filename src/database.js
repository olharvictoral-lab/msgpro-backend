const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// No Railway usa /tmp (temporário mas funciona para teste)
// Em produção real, use PostgreSQL
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'msgpro.db'));

// ─── Criar tabelas ───
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id           TEXT PRIMARY KEY,
    platform     TEXT NOT NULL,
    message      TEXT NOT NULL,
    media_url    TEXT,
    destinations TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    repeat_type  TEXT DEFAULT 'once',
    delay_seconds INTEGER DEFAULT 5,
    status       TEXT DEFAULT 'pending',
    sent_at      TEXT,
    error        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT,
    username   TEXT,
    platform   TEXT NOT NULL,
    group_ids  TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups_cache (
    id         TEXT PRIMARY KEY,
    platform   TEXT NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT DEFAULT 'group',
    members    INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS send_log (
    id          TEXT PRIMARY KEY,
    schedule_id TEXT,
    platform    TEXT,
    destination TEXT,
    status      TEXT,
    sent_at     TEXT DEFAULT (datetime('now')),
    error       TEXT
  );
`);

db.prepare(`CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_schedules_at    ON schedules(scheduled_at)`).run();

module.exports = db;

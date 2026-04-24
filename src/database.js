const path = require('path');
const fs   = require('fs');

// Banco simples em JSON usando lowdb v1
const low    = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'msgpro.json'));
const db      = low(adapter);

// Estrutura inicial
db.defaults({
  schedules:    [],
  contacts:     [],
  groups_cache: [],
  send_log:     []
}).write();

// ─── Helpers para simular a API do better-sqlite3 ───

db.prepare = (sql) => {
  // Parser mínimo para os padrões usados no projeto
  return {
    run:  (...args) => runSQL(sql, args),
    get:  (...args) => getSQL(sql, args),
    all:  (...args) => allSQL(sql, args),
  };
};

db.exec = () => {}; // não precisa criar tabelas

function getTable(sql) {
  const m = sql.match(/(?:FROM|INTO|UPDATE|REPLACE INTO)\s+(\w+)/i);
  return m ? m[1] : null;
}

function runSQL(sql, args) {
  const s   = sql.trim().toUpperCase();
  const tbl = getTable(sql);
  if (!tbl) return;

  if (s.startsWith('INSERT OR REPLACE') || s.startsWith('INSERT INTO')) {
    const cols = sql.match(/\(([^)]+)\)/)?.[1].split(',').map(c => c.trim());
    if (!cols) return;
    const obj = {};
    cols.forEach((c, i) => { obj[c] = args[i] ?? null; });
    const existing = db.get(tbl).find({ id: obj.id }).value();
    if (existing) {
      db.get(tbl).find({ id: obj.id }).assign(obj).write();
    } else {
      db.get(tbl).push(obj).write();
    }
  }

  if (s.startsWith('UPDATE')) {
    const setMatch  = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
    if (setMatch && whereMatch) {
      const setPairs = setMatch[1].split(',').map(p => p.trim());
      const updates  = {};
      let   argIdx   = 0;
      setPairs.forEach(p => {
        const [col] = p.split('=').map(x => x.trim());
        if (col !== 'id') updates[col] = args[argIdx++];
      });
      const id = args[args.length - 1];
      db.get(tbl).find({ id }).assign(updates).write();
    }
  }

  if (s.startsWith('DELETE')) {
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
    if (whereMatch) {
      db.get(tbl).remove({ id: args[0] }).write();
    }
  }
}

function getSQL(sql, args) {
  const tbl = getTable(sql);
  if (!tbl) return null;
  const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (whereMatch) {
    const col = whereMatch[1];
    const filter = {};
    filter[col] = args[0];
    return db.get(tbl).find(filter).value() || null;
  }
  return db.get(tbl).first().value() || null;
}

function allSQL(sql, args) {
  const tbl = getTable(sql);
  if (!tbl) return [];
  let rows = db.get(tbl).value() || [];

  // Filtros simples WHERE col = ?
  const whereMatches = [...sql.matchAll(/(\w+)\s*=\s*\?/gi)];
  whereMatches.forEach((m, i) => {
    const col = m[1];
    if (col !== 'id') rows = rows.filter(r => r[col] === args[i]);
  });

  // ORDER BY
  const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const col = orderMatch[1];
    const dir = (orderMatch[2] || 'ASC').toUpperCase();
    rows = [...rows].sort((a, b) => {
      if (a[col] < b[col]) return dir === 'ASC' ? -1 : 1;
      if (a[col] > b[col]) return dir === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

  return rows;
}

module.exports = db;

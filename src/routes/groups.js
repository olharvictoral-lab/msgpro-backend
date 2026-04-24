const express = require('express');
const router  = express.Router();
const db      = require('../database');

// Listar todos os grupos em cache
router.get('/', (req, res) => {
  const { platform } = req.query;
  let query = 'SELECT * FROM groups_cache WHERE 1=1';
  const params = [];
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  query += ' ORDER BY name ASC';
  const rows = db.prepare(query).all(...params);
  res.json({ ok: true, groups: rows });
});

// Buscar grupo por id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM groups_cache WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Grupo não encontrado' });
  res.json({ ok: true, group: row });
});

module.exports = router;

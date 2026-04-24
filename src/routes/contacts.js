const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Listar contatos
router.get('/', (req, res) => {
  const { platform } = req.query;
  let query = 'SELECT * FROM contacts WHERE 1=1';
  const params = [];
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  query += ' ORDER BY name ASC';
  const rows = db.prepare(query).all(...params);
  res.json({ ok: true, contacts: rows });
});

// Criar contato
router.post('/', (req, res) => {
  try {
    const { name, phone, username, platform, group_ids } = req.body;
    if (!name || !platform) return res.status(400).json({ ok: false, error: 'name e platform obrigatórios' });
    const id = uuidv4();
    db.prepare(`INSERT INTO contacts (id, name, phone, username, platform, group_ids) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, name, phone || null, username || null, platform, group_ids ? JSON.stringify(group_ids) : null);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Deletar contato
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true, message: 'Contato removido' });
});

module.exports = router;

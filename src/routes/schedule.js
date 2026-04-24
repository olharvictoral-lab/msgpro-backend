const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Listar agendamentos
router.get('/', (req, res) => {
  const { status, platform } = req.query;
  let query  = 'SELECT * FROM schedules WHERE 1=1';
  const params = [];
  if (status)   { query += ' AND status = ?';   params.push(status); }
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  query += ' ORDER BY scheduled_at DESC LIMIT 100';
  const rows = db.prepare(query).all(...params);
  res.json({ ok: true, schedules: rows });
});

// Criar agendamento
router.post('/', (req, res) => {
  try {
    const { platform, message, destinations, scheduled_at, repeat_type, delay_seconds } = req.body;

    if (!platform || !message || !destinations || !scheduled_at) {
      return res.status(400).json({ ok: false, error: 'platform, message, destinations e scheduled_at são obrigatórios' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO schedules (id, platform, message, destinations, scheduled_at, repeat_type, delay_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, platform, message,
      JSON.stringify(destinations),
      scheduled_at,
      repeat_type || 'once',
      delay_seconds || 5
    );

    res.json({ ok: true, id, message: 'Agendamento criado com sucesso' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Detalhes de um agendamento
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: 'Não encontrado' });
  res.json({ ok: true, schedule: row });
});

// Cancelar agendamento
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE schedules SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, message: 'Agendamento cancelado' });
});

// Log de envios
router.get('/:id/log', (req, res) => {
  const rows = db.prepare('SELECT * FROM send_log WHERE schedule_id = ? ORDER BY sent_at DESC').all(req.params.id);
  res.json({ ok: true, log: rows });
});

module.exports = router;

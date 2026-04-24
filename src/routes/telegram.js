const express = require('express');
const router  = express.Router();
const tgMgr   = require('../telegram-manager');

// Status
router.get('/status', (req, res) => {
  res.json(tgMgr.getStatus());
});

// Conectar com token
router.post('/connect', async (req, res) => {
  try {
    const { token } = req.body;
    const result = await tgMgr.connect(token);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Listar grupos/chats
router.get('/groups', (req, res) => {
  res.json({ ok: true, groups: tgMgr.getGroups() });
});

// Enviar mensagem de teste
router.post('/send', async (req, res) => {
  try {
    const { chatId, message } = req.body;
    if (!chatId || !message) return res.status(400).json({ ok: false, error: 'chatId e message obrigatórios' });
    const result = await tgMgr.sendText(chatId, message);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Desconectar
router.post('/disconnect', (req, res) => {
  tgMgr.disconnect();
  res.json({ ok: true, message: 'Telegram desconectado' });
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const wpMgr   = require('../whatsapp-manager');

// Status do WhatsApp
router.get('/status', (req, res) => {
  res.json(wpMgr.getStatus());
});

// Iniciar conexão e gerar QR
router.post('/connect', async (req, res) => {
  try {
    const result = await wpMgr.connect();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Obter QR Code atual (retorna imagem base64)
router.get('/qr', (req, res) => {
  const qr = wpMgr.getQR();
  if (!qr) {
    return res.status(404).json({ ok: false, error: 'QR não disponível. Chame /connect primeiro.' });
  }
  res.json({ ok: true, qr });
});

// Listar grupos
router.get('/groups', (req, res) => {
  res.json({ ok: true, groups: wpMgr.getGroups() });
});

// Enviar mensagem de teste
router.post('/send', async (req, res) => {
  try {
    const { jid, message } = req.body;
    if (!jid || !message) return res.status(400).json({ ok: false, error: 'jid e message obrigatórios' });
    const result = await wpMgr.sendText(jid, message, 1);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Desconectar
router.post('/disconnect', async (req, res) => {
  try {
    await wpMgr.disconnect();
    res.json({ ok: true, message: 'Desconectado com sucesso' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

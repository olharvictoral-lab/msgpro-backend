const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const EVO_URL  = process.env.EVO_URL  || 'https://athletic-elegance-production-93bd.up.railway.app';
const EVO_KEY  = process.env.EVO_KEY  || 'msgpro2024secretkey';
const EVO_INST = process.env.EVO_INST || 'msgpro2';

const evo = axios.create({
  baseURL: EVO_URL,
  headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' }
});

// Status
router.get('/status', async (req, res) => {
  try {
    const { data } = await evo.get('/instance/fetchInstances');
    const inst = Array.isArray(data) ? data.find(i => i.name === EVO_INST) : null;
    res.json({
      connected: inst?.connectionStatus === 'open',
      status: inst?.connectionStatus || 'disconnected',
      qrAvailable: false,
      number: inst?.ownerJid?.replace('@s.whatsapp.net','') || null
    });
  } catch (e) {
    res.json({ connected: false, status: 'disconnected', qrAvailable: false });
  }
});

// Conectar e gerar QR
router.post('/connect', async (req, res) => {
  try {
    // Verifica se já existe instância
    const { data: instances } = await evo.get('/instance/fetchInstances');
    const inst = Array.isArray(instances) ? instances.find(i => i.name === EVO_INST) : null;
    
    if (!inst) {
      // Cria instância
      await evo.post('/instance/create', {
        instanceName: EVO_INST,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
    }
    res.json({ ok: true, message: 'Conectando... Busque o QR em /api/whatsapp/qr' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// QR Code — proxy da Evolution API
router.get('/qr', async (req, res) => {
  try {
    const { data } = await evo.get('/instance/connect/' + EVO_INST);
    if (data && data.base64) {
      res.json({ ok: true, qr: data.base64 });
    } else {
      res.status(404).json({ ok: false, error: 'QR não disponível ainda. Tente em 3 segundos.' });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Grupos
router.get('/groups', async (req, res) => {
  try {
    const { data } = await evo.get('/group/fetchAllGroups/' + EVO_INST + '?getParticipants=false');
    const groups = Array.isArray(data) ? data.map(g => ({
      id: g.id,
      name: g.subject || g.id,
      participants: g.size || 0,
      type: 'group'
    })) : [];
    res.json({ ok: true, groups });
  } catch (e) {
    res.json({ ok: true, groups: [] });
  }
});

// Enviar mensagem
router.post('/send', async (req, res) => {
  try {
    const { jid, message } = req.body;
    if (!jid || !message) return res.status(400).json({ ok: false, error: 'jid e message obrigatórios' });
    const { data } = await evo.post('/message/sendText/' + EVO_INST, {
      number: jid,
      text: message
    });
    res.json({ ok: true, result: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Desconectar
router.post('/disconnect', async (req, res) => {
  try {
    await evo.delete('/instance/logout/' + EVO_INST);
    res.json({ ok: true, message: 'Desconectado com sucesso' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

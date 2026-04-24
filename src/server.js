const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Banco de Dados (inicializa tabelas) ───
require('./database');

// ─── Rotas API ───
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/telegram',  require('./routes/telegram'));
app.use('/api/schedule',  require('./routes/schedule'));
app.use('/api/groups',    require('./routes/groups'));
app.use('/api/contacts',  require('./routes/contacts'));

// ─── Health check ───
app.get('/api/status', (req, res) => {
  const wpMgr = require('./whatsapp-manager');
  const tgMgr = require('./telegram-manager');
  res.json({
    status:    'online',
    version:   '2.0.0',
    whatsapp:  wpMgr.getStatus(),
    telegram:  tgMgr.getStatus(),
    uptime:    Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

// ─── Página inicial simples (sem frontend por enquanto) ───
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>MsgPro API</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; }
        h1   { color: #25D366; }
        a    { color: #075E54; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
        ul   { line-height: 2; }
      </style>
    </head>
    <body>
      <h1>🚀 MsgPro Backend</h1>
      <p>API rodando com sucesso!</p>
      <h3>Endpoints disponíveis:</h3>
      <ul>
        <li><a href="/api/status" target="_blank">GET /api/status</a> — Status geral</li>
        <li><code>POST /api/whatsapp/connect</code> — Iniciar WhatsApp</li>
        <li><code>GET  /api/whatsapp/qr</code> — Obter QR Code</li>
        <li><code>GET  /api/whatsapp/groups</code> — Listar grupos</li>
        <li><code>POST /api/schedule</code> — Criar agendamento</li>
        <li><code>GET  /api/schedule</code> — Listar agendamentos</li>
      </ul>
      <p>Conecte seu frontend em: <code>${process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:' + PORT}</code></p>
    </body>
    </html>
  `);
});

// ─── Scheduler (jobs agendados) ───
require('./scheduler');

// ─── Start ───
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MsgPro Backend rodando na porta ${PORT}`);
  console.log(`🔗 Status: http://localhost:${PORT}/api/status\n`);
});

module.exports = app;

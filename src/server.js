const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','apikey']
}));
app.options('*', cors());
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
  res.json({
    status:    'online',
    version:   '2.0.0',
    uptime:    Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

// ─── Página inicial ───
app.get('/', (req, res) => {
  res.json({ status: 'MsgPro Backend online', version: '2.0.0' });
});

// ─── Scheduler ───
require('./scheduler');

// ─── Start ───
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MsgPro Backend rodando na porta ${PORT}`);
  console.log(`🔗 Status: http://localhost:${PORT}/api/status\n`);
});

module.exports = app;

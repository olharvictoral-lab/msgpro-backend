# MsgPro Backend

Backend para agendamento de mensagens WhatsApp + Telegram.

## Estrutura de arquivos

```
msgpro-backend/
├── src/
│   ├── server.js              ← Arquivo principal
│   ├── database.js            ← Banco SQLite
│   ├── whatsapp-manager.js    ← Conexão WhatsApp
│   ├── telegram-manager.js    ← Conexão Telegram
│   ├── scheduler.js           ← Processador de agendamentos
│   └── routes/
│       ├── whatsapp.js
│       ├── telegram.js
│       ├── schedule.js
│       ├── groups.js
│       └── contacts.js
├── package.json
├── .env.example
└── .gitignore
```

## Deploy no Railway

1. Crie conta em railway.app
2. New Project → Deploy from GitHub
3. Selecione este repositório
4. Em Variables, adicione:
   - `TELEGRAM_BOT_TOKEN` (opcional, só se usar Telegram)
5. Em Settings → Networking → Generate Domain

## Rotas principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/status | Status geral |
| POST | /api/whatsapp/connect | Iniciar conexão WhatsApp |
| GET | /api/whatsapp/qr | Obter QR Code |
| GET | /api/whatsapp/groups | Listar grupos |
| POST | /api/telegram/connect | Conectar bot Telegram |
| POST | /api/schedule | Criar agendamento |
| GET | /api/schedule | Listar agendamentos |
| DELETE | /api/schedule/:id | Cancelar agendamento |

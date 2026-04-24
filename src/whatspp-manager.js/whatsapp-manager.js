const path = require('path');
const fs = require('fs');

const AUTH_FOLDER = path.join(__dirname, '../auth_info');

class WhatsAppManager {
  constructor() {
    this.sock = null;
    this.qr = null;
    this.status = 'disconnected';
    this.groups = [];
    this._baileys = null;
  }

  async _getBaileys() {
    if (!this._baileys) {
      this._baileys = await import('@whiskeysockets/baileys');
    }
    return this._baileys;
  }

  getStatus() {
    return {
      connected: this.status === 'connected',
      status: this.status,
      qrAvailable: !!this.qr,
    };
  }

  getQR() {
    return this.qr;
  }

  getGroups() {
    return this.groups;
  }

  async connect() {
    if (this.status === 'connected') {
      return { ok: true, message: 'Já conectado' };
    }

    this.status = 'connecting';
    this.qr = null;

    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    const baileys = await this._getBaileys();
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ['MsgPro', 'Chrome', '1.0.0'],
      logger: (await import('pino')).default({ level: 'silent' }),
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const QRCode = require('qrcode');
          this.qr = await QRCode.toDataURL(qr);
          this.status = 'qr_ready';
          console.log('[WhatsApp] QR Code gerado com sucesso');
        } catch (err) {
          console.error('[WhatsApp] Erro ao gerar QR:', err.message);
        }
      }

      if (connection === 'open') {
        this.status = 'connected';
        this.qr = null;
        console.log('[WhatsApp] Conectado!');
        await this._loadGroups();
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log('[WhatsApp] Desconectado. Código:', code);

        // 401 = logout, não reconecta
        if (code === 401 || code === 440) {
          this.status = 'disconnected';
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          console.log('[WhatsApp] Sessão encerrada. Reconecte manualmente.');
        } else {
          this.status = 'reconnecting';
          console.log('[WhatsApp] Reconectando em 5s...');
          setTimeout(() => this.connect(), 5000);
        }
      }
    });

    return { ok: true, message: 'Conectando... Aguarde o QR Code em /api/whatsapp/qr' };
  }

  async _loadGroups() {
    try {
      const allGroups = await this.sock.groupFetchAllParticipating();
      this.groups = Object.values(allGroups).map((g) => ({
        id: g.id,
        name: g.subject,
        participants: g.participants?.length || 0,
      }));
      console.log(`[WhatsApp] ${this.groups.length} grupos carregados`);
    } catch (err) {
      console.error('[WhatsApp] Erro ao carregar grupos:', err.message);
    }
  }

  async sendText(jid, message, delay = 1) {
    if (this.status !== 'connected') {
      throw new Error('WhatsApp não conectado.');
    }
    const formattedJid = jid.includes('@') ? jid : `${jid}@g.us`;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay * 1000));
    }
    return await this.sock.sendMessage(formattedJid, { text: message });
  }

  async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
    this.status = 'disconnected';
    this.qr = null;
    this.groups = [];
    return { ok: true, message: 'Desconectado com sucesso' };
  }
}

module.exports = new WhatsAppManager();

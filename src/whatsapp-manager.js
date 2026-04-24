const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const AUTH_FOLDER = path.join(__dirname, '../auth_info');
const logger = pino({ level: 'silent' });

class WhatsAppManager {
  constructor() {
    this.sock = null;
    this.qr = null;
    this.status = 'disconnected';
    this.groups = [];
    this.store = makeInMemoryStore({ logger });
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

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: ['MsgPro', 'Chrome', '1.0.0'],
    });

    this.store.bind(this.sock.ev);

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const QRCode = require('qrcode');
        this.qr = await QRCode.toDataURL(qr);
        this.status = 'qr_ready';
        console.log('[WhatsApp] QR Code gerado');
      }

      if (connection === 'open') {
        this.status = 'connected';
        this.qr = null;
        console.log('[WhatsApp] Conectado com sucesso!');
        await this._loadGroups();
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        this.status = shouldReconnect ? 'reconnecting' : 'disconnected';
        console.log('[WhatsApp] Desconectado. Código:', code);

        if (shouldReconnect) {
          console.log('[WhatsApp] Reconectando...');
          setTimeout(() => this.connect(), 5000);
        } else {
          // Limpa auth se fez logout
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
      }
    });

    this.sock.ev.on('groups.update', async () => {
      await this._loadGroups();
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
      throw new Error('WhatsApp não conectado. Conecte primeiro via /api/whatsapp/connect');
    }
    if (!jid || !message) {
      throw new Error('jid e message são obrigatórios');
    }

    // Garante formato correto do JID
    const formattedJid = jid.includes('@') ? jid : `${jid}@g.us`;

    // Delay para evitar ban
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay * 1000));
    }

    const result = await this.sock.sendMessage(formattedJid, { text: message });
    return result;
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

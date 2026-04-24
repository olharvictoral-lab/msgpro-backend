const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');

class WhatsAppManager {
  constructor() {
    this.client = null;
    this.qr = null;
    this.status = 'disconnected';
    this.groups = [];
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

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '/tmp/wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    });

    this.client.on('qr', async (qr) => {
      this.qr = await QRCode.toDataURL(qr);
      this.status = 'qr_ready';
      console.log('[WhatsApp] QR Code gerado!');
    });

    this.client.on('ready', async () => {
      this.status = 'connected';
      this.qr = null;
      console.log('[WhatsApp] Conectado!');
      await this._loadGroups();
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'disconnected';
      this.qr = null;
      this.groups = [];
      console.log('[WhatsApp] Desconectado:', reason);
    });

    this.client.initialize();

    return { ok: true, message: 'Conectando... Aguarde o QR Code em /api/whatsapp/qr' };
  }

  async _loadGroups() {
    try {
      const chats = await this.client.getChats();
      this.groups = chats
        .filter((c) => c.isGroup)
        .map((g) => ({
          id: g.id._serialized,
          name: g.name,
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
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay * 1000));
    }
    return await this.client.sendMessage(jid, message);
  }

  async disconnect() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.status = 'disconnected';
    this.qr = null;
    this.groups = [];
    return { ok: true, message: 'Desconectado com sucesso' };
  }
}

module.exports = new WhatsAppManager();

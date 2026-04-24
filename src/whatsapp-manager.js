const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs   = require('fs');
const pino = require('pino');
const QRCode = require('qrcode');

// No Railway usa /tmp para sessão (temporário mas suficiente para teste)
const sessionsDir = process.env.SESSIONS_DIR || path.join(__dirname, '../../sessions/whatsapp');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

class WhatsAppManager {
  constructor() {
    this.sock            = null;
    this.status          = 'disconnected';
    this.qrBase64        = null;
    this.statusCallbacks = [];
    this.groups          = [];
    this.phone           = null;
  }

  getStatus() {
    return {
      status:   this.status,
      phone:    this.phone,
      groups:   this.groups.length,
      qr_ready: this.status === 'qr_ready'
    };
  }

  getQR()     { return this.qrBase64; }
  getGroups() { return this.groups;   }
  onStatus(cb){ this.statusCallbacks.push(cb); }

  _emit(status, extra = {}) {
    this.status = status;
    this.statusCallbacks.forEach(cb => cb({ status, ...extra }));
  }

  async connect() {
    if (this.status === 'connected') return { ok: true, status: 'already_connected' };
    this._emit('connecting');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);
    const { version }          = await fetchLatestBaileysVersion();
    const logger               = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, logger)
      },
      getMessage: async () => ({ conversation: 'hello' })
    });

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          this.qrBase64 = await QRCode.toDataURL(qr, {
            width: 300, margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          this._emit('qr_ready', { qr: this.qrBase64 });
          console.log('📱 QR Code gerado — aguardando escaneamento...');
        } catch (e) {
          console.error('Erro ao gerar QR:', e);
        }
      }

      if (connection === 'close') {
        const code            = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log('🔴 WhatsApp desconectado. Código:', code, '| Reconectar:', shouldReconnect);
        this._emit('disconnected');
        this.qrBase64 = null;
        if (shouldReconnect) setTimeout(() => this.connect(), 3000);
      }

      if (connection === 'open') {
        this.phone = this.sock.user?.id?.split(':')[0] || 'conectado';
        this._emit('connected', { phone: this.phone });
        console.log('✅ WhatsApp conectado! Número:', this.phone);
        await this._loadGroups();
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('groups.update',             async () => { await this._loadGroups(); });
    this.sock.ev.on('group-participants.update',  async () => { await this._loadGroups(); });

    return { ok: true, status: 'connecting' };
  }

  async _loadGroups() {
    try {
      if (!this.sock) return;
      const raw    = await this.sock.groupFetchAllParticipating();
      this.groups  = Object.values(raw).map(g => ({
        id:      g.id,
        name:    g.subject || 'Sem nome',
        members: g.participants?.length || 0,
        type:    'group',
        desc:    g.desc || ''
      }));

      const db  = require('./database');
      const ins = db.prepare(
        `INSERT OR REPLACE INTO groups_cache (id,platform,name,type,members,updated_at)
         VALUES (?,?,?,?,?,datetime('now'))`
      );
      this.groups.forEach(g => ins.run(g.id, 'whatsapp', g.name, g.type, g.members));
      console.log(`👥 ${this.groups.length} grupos WhatsApp carregados`);
    } catch (e) {
      console.error('Erro ao carregar grupos:', e.message);
    }
  }

  async sendText(jid, message, delay = 5) {
    if (!this.sock || this.status !== 'connected') throw new Error('WhatsApp não conectado');
    await new Promise(r => setTimeout(r, delay * 1000));
    await this.sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, 1200));
    await this.sock.sendPresenceUpdate('paused', jid);
    return await this.sock.sendMessage(jid, { text: message });
  }

  async sendToGroups(groupIds, message, delay = 5) {
    const results = [];
    for (const gid of groupIds) {
      try {
        const r = await this.sendText(gid, message, delay);
        results.push({ id: gid, ok: true, msgId: r?.key?.id });
        console.log(`✅ WP enviado para ${gid}`);
      } catch (e) {
        results.push({ id: gid, ok: false, error: e.message });
        console.error(`❌ WP erro em ${gid}:`, e.message);
      }
      await new Promise(r => setTimeout(r, delay * 1000 + Math.random() * 3000));
    }
    return results;
  }

  async disconnect() {
    if (this.sock) { await this.sock.logout(); this.sock = null; }
    this.status   = 'disconnected';
    this.qrBase64 = null;
    this.groups   = [];
    this.phone    = null;
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
}

module.exports = new WhatsAppManager();

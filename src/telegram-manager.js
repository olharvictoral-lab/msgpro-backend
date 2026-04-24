// telegram-manager.js
// Gerencia conexão e envio via Telegram Bot API

class TelegramManager {
  constructor() {
    this.bot    = null;
    this.status = 'disconnected';
    this.groups = [];
    this.token  = null;
  }

  getStatus() {
    return {
      status:    this.status,
      token_set: !!this.token,
      groups:    this.groups.length
    };
  }

  getGroups() { return this.groups; }

  async connect(token) {
    const tokenToUse = token || process.env.TELEGRAM_BOT_TOKEN;
    if (!tokenToUse) {
      return { ok: false, error: 'Token não fornecido. Configure TELEGRAM_BOT_TOKEN no Railway.' };
    }

    try {
      const TelegramBot = require('node-telegram-bot-api');
      this.bot    = new TelegramBot(tokenToUse, { polling: false });
      this.token  = tokenToUse;

      // Testa o token
      const me    = await this.bot.getMe();
      this.status = 'connected';
      console.log(`✅ Telegram conectado: @${me.username}`);
      return { ok: true, bot: me };
    } catch (e) {
      this.status = 'error';
      console.error('❌ Erro Telegram:', e.message);
      return { ok: false, error: e.message };
    }
  }

  async sendText(chatId, message) {
    if (!this.bot) throw new Error('Telegram não conectado');
    return await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }

  async sendToGroups(groupIds, message) {
    const results = [];
    for (const gid of groupIds) {
      try {
        await this.sendText(gid, message);
        results.push({ id: gid, ok: true });
        console.log(`✅ TG enviado para ${gid}`);
      } catch (e) {
        results.push({ id: gid, ok: false, error: e.message });
        console.error(`❌ TG erro em ${gid}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return results;
  }

  disconnect() {
    if (this.bot) { try { this.bot.stopPolling(); } catch(e){} }
    this.bot    = null;
    this.status = 'disconnected';
    this.token  = null;
  }
}

module.exports = new TelegramManager();

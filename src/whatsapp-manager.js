// WhatsApp Manager - versão stub para deploy inicial
class WhatsAppManager {
  constructor() {
    this.status = 'disconnected';
    this.groups = [];
    this.phone  = null;
  }
  getStatus() { return { status: this.status, phone: this.phone, groups: 0, qr_ready: false }; }
  getQR()     { return null; }
  getGroups() { return []; }
  onStatus()  {}
  async connect()     { return { ok: false, error: 'WhatsApp será integrado em breve' }; }
  async sendText()    { throw new Error('WhatsApp não disponível nesta versão'); }
  async sendToGroups(){ return []; }
  async disconnect()  {}
}
module.exports = new WhatsAppManager();

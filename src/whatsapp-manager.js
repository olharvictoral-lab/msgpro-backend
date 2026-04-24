class WhatsAppManager {
  getStatus() {
    return { connected: false, status: 'disconnected', qrAvailable: false };
  }
  getQR() { return null; }
  getGroups() { return []; }
}
module.exports = new WhatsAppManager();
 

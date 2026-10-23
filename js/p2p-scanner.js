/**
 * p2p-scanner.js - WebRTC PeerJS + QRCode P2P Mobile Sync Bridge
 */
class P2PScanner {
  constructor(options = {}) {
    this.peer = null;
    this.activeConn = null;
    this.peerId = '';
    this.onPageReceived = options.onPageReceived || (() => {});
    this.onStatusChanged = options.onStatusChanged || (() => {});
  }

  generatePeerId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const p1 = Array.from({ length: 3 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const p2 = Array.from({ length: 3 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `fb-${p1}-${p2}`;
  }

  initHost() {
    const customId = this.generatePeerId();
    this.peerId = customId;

    try {
      this.peer = new Peer(customId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        this.renderQrCode(id);
        this.onStatusChanged('waiting', id);
      });

      this.peer.on('connection', (conn) => {
        this.activeConn = conn;
        
        conn.on('open', () => {
          const deviceName = conn.metadata?.deviceName || 'Mobile Phone';
          this.onStatusChanged('connected', deviceName);
          conn.send({ type: 'HANDSHAKE', deviceName: 'FieldBi Web Studio' });
        });

        conn.on('data', (data) => {
          if (data.type === 'SCANNED_PAGE' && data.dataUrl) {
            this.onPageReceived(data.dataUrl, data.fileName);
            conn.send({ type: 'PAGE_ACK', timestamp: Date.now() });
          }
        });

        conn.on('close', () => {
          this.activeConn = null;
          this.onStatusChanged('waiting', this.peerId);
        });
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        this.onStatusChanged('error', err.message);
      });
    } catch (e) {
      console.error('Failed to init PeerJS:', e);
    }
  }

  renderQrCode(id) {
    const qrCanvas = document.getElementById('qrCanvas');
    if (!qrCanvas || typeof QRCode === 'undefined') return;

    // Use current URL with ?peer=... query for instant auto-connect
    const pairingUrl = `${window.location.origin}${window.location.pathname}?peer=${encodeURIComponent(id)}`;

    QRCode.toCanvas(qrCanvas, pairingUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  }

  disconnect() {
    if (this.activeConn) {
      this.activeConn.close();
      this.activeConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.onStatusChanged('disconnected', '');
  }
}

import React, { useState, useEffect } from 'react';
import { Modal } from '../../../shared/components/Modal';
import {
  Bluetooth,
  RefreshCw,
  WifiOff,
  Radio,
  ShieldCheck,
  QrCode,
  Check,
  Copy,
  Zap,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import QRCode from 'qrcode';
import { offlineDirectChannel } from '../../../shared/lib/transport/offlineDirectChannel';
import { bluetoothTransport } from '../../../shared/lib/transport/bluetoothTransport';
import { BluetoothPeerDevice } from '../../../shared/lib/transport/types';
import { outboxManager } from '../../../shared/lib/outboxManager';
import { QRScanner } from '../../../shared/components/QRScanner';

interface BluetoothScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothScanModal: React.FC<BluetoothScanModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'qr'>('qr');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeer, setConnectedPeer] = useState<BluetoothPeerDevice | null>(null);

  // QR Mode States
  const [qrStep, setQrStep] = useState<'idle' | 'host' | 'join'>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [offerToken, setOfferToken] = useState('');
  const [answerToken, setAnswerToken] = useState('');
  const [inputToken, setInputToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const queuedCount = outboxManager.getQueuedCount();

  // Subscribe to Direct Channel connection status
  useEffect(() => {
    const unsub = offlineDirectChannel.subscribeStatus((connected, peer) => {
      setIsConnected(connected);
      setConnectedPeer(peer);
    });
    return unsub;
  }, []);

  // Quick Connect
  const handleQuickConnect = () => {
    offlineDirectChannel.connectLocalPeer('Nearby Contact (Direct P2P)');
  };

  // Host QR Flow: Device A creates Offer
  const handleStartHost = async () => {
    setIsProcessing(true);
    setQrStep('host');
    setShowScanner(false);
    try {
      const offer = await offlineDirectChannel.createPairingOffer();
      setOfferToken(offer);
      const url = await QRCode.toDataURL(offer, { width: 220, margin: 1 });
      setQrDataUrl(url);
    } catch (e) {
      console.error('Error creating offer:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Join QR Flow: Device B processes scanned/entered Offer & generates Answer
  const processOfferToken = async (token: string) => {
    if (!token.trim()) return;
    setIsProcessing(true);
    setShowScanner(false);
    try {
      const answer = await offlineDirectChannel.acceptPairingOffer(token.trim());
      setAnswerToken(answer);
      const url = await QRCode.toDataURL(answer, { width: 220, margin: 1 });
      setQrDataUrl(url);
    } catch (e) {
      alert('Invalid pairing QR code. Please scan Device A again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Host completes handshake by processing scanned/entered Answer
  const processAnswerToken = async (token: string) => {
    if (!token.trim()) return;
    setIsProcessing(true);
    setShowScanner(false);
    try {
      const ok = await offlineDirectChannel.completePairing(token.trim());
      if (ok) {
        setQrStep('idle');
        setInputToken('');
      } else {
        alert('Pairing failed. Please re-generate the pairing code and try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    offlineDirectChannel.close();
    bluetoothTransport.disconnect();
    setQrStep('idle');
    setQrDataUrl(null);
    setOfferToken('');
    setAnswerToken('');
    setInputToken('');
    setShowScanner(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Offline Direct P2P & Bluetooth">
      <div className="flex flex-col space-y-4">
        {/* Info Card */}
        <div className="flex items-start space-x-3 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs">
          <Bluetooth size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex flex-col space-y-1">
            <span className="font-semibold">Direct Camera QR Pairing</span>
            <p className="text-text-secondary leading-relaxed">
              Scan your friend's screen with your camera to pair instantly offline. Send messages, delivery ticks, and read receipts with zero internet!
            </p>
          </div>
        </div>

        {/* Queued Outbox Notice */}
        {queuedCount > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
            <div className="flex items-center space-x-2">
              <WifiOff size={14} />
              <span>{queuedCount} message(s) queued for transfer</span>
            </div>
          </div>
        )}

        {/* Active Connected Banner */}
        {isConnected ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs animate-message-in">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-pulse">
                <Radio size={16} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-text-primary">{connectedPeer?.name || 'Direct Peer'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                  <CheckCircle2 size={12} />
                  <span>Direct Mesh Connected &bull; Real-time Sync Active</span>
                </span>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-muted hover:bg-surface-elevated text-rose-500 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : null}

        {/* Tab Selector */}
        {!isConnected && (
          <div className="flex items-center space-x-1 p-1 bg-surface-muted rounded-xl border border-border-default/60">
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'qr' ? 'bg-surface-elevated text-text-primary shadow-subtle' : 'text-text-secondary'
              }`}
            >
              Camera QR Pairing
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'quick' ? 'bg-surface-elevated text-text-primary shadow-subtle' : 'text-text-secondary'
              }`}
            >
              1-Click Fast Connect
            </button>
          </div>
        )}

        {/* TAB 1: Camera QR Handshake Flow */}
        {!isConnected && activeTab === 'qr' && (
          <div className="flex flex-col space-y-3">
            {qrStep === 'idle' && (
              <div className="grid grid-cols-2 gap-2.5">
                {/* Device A: Host */}
                <button
                  onClick={handleStartHost}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl border border-border-default bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center space-y-2 text-center transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent-500/10 text-accent-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <QrCode size={22} />
                  </div>
                  <span className="text-xs font-semibold text-text-primary">Device A: Host</span>
                  <span className="text-[10px] text-text-tertiary">Show Pairing QR Code</span>
                </button>

                {/* Device B: Join / Scan */}
                <button
                  onClick={() => {
                    setQrStep('join');
                    setShowScanner(true);
                  }}
                  className="p-4 rounded-2xl border border-border-default bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center space-y-2 text-center transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera size={22} />
                  </div>
                  <span className="text-xs font-semibold text-text-primary">Device B: Scan QR</span>
                  <span className="text-[10px] text-text-tertiary">Scan Device A with Camera</span>
                </button>
              </div>
            )}

            {/* Step: Host Displaying Offer QR Code */}
            {qrStep === 'host' && (
              <div className="flex flex-col items-center space-y-3 text-center">
                {showScanner ? (
                  <div className="w-full flex flex-col space-y-2">
                    <span className="text-xs font-semibold text-text-primary">Point camera at Device B's Answer QR:</span>
                    <QRScanner onScan={(data) => processAnswerToken(data)} onClose={() => setShowScanner(false)} />
                  </div>
                ) : (
                  <>
                    {qrDataUrl ? (
                      <div className="p-3.5 bg-white rounded-2xl shadow-elevated border border-border-subtle">
                        <img src={qrDataUrl} alt="Pairing QR" className="w-48 h-48 rounded-xl" />
                      </div>
                    ) : (
                      <div className="w-48 h-48 rounded-2xl bg-surface-muted flex items-center justify-center">
                        <RefreshCw size={24} className="animate-spin text-accent-500" />
                      </div>
                    )}

                    <p className="text-xs text-text-secondary">
                      Ask Device B to tap <strong>"Device B: Scan QR"</strong> and point their camera at this QR code.
                    </p>

                    <button
                      onClick={() => setShowScanner(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold shadow-subtle flex items-center justify-center space-x-2 transition-transform active:scale-98"
                    >
                      <Camera size={15} />
                      <span>Scan Device B's Answer QR with Camera</span>
                    </button>

                    <div className="flex items-center space-x-2 w-full pt-1">
                      <button
                        onClick={() => handleCopy(offerToken)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-border-default text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    </div>
                  </>
                )}

                <button
                  onClick={() => {
                    setQrStep('idle');
                    setShowScanner(false);
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary pt-1"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {/* Step: Device B Scan & Answer Display */}
            {qrStep === 'join' && (
              <div className="flex flex-col space-y-3 text-center">
                {showScanner ? (
                  <div className="w-full flex flex-col space-y-2">
                    <span className="text-xs font-semibold text-text-primary">Scan Device A's QR Code:</span>
                    <QRScanner onScan={(data) => processOfferToken(data)} onClose={() => setShowScanner(false)} />
                  </div>
                ) : answerToken ? (
                  <div className="flex flex-col items-center space-y-3">
                    <span className="text-xs font-semibold text-text-primary">Show this Answer QR to Device A:</span>
                    <div className="p-3.5 bg-white rounded-2xl shadow-elevated border border-border-subtle">
                      <img src={qrDataUrl!} alt="Answer QR" className="w-48 h-48 rounded-xl" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      Device A scans this QR code to complete the direct offline link!
                    </p>
                    <button
                      onClick={() => handleCopy(answerToken)}
                      className="w-full py-2 px-3 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-border-default text-xs font-medium flex items-center justify-center space-x-1.5"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied Answer!' : 'Copy Answer Code'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={() => setShowScanner(true)}
                      className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-subtle flex items-center justify-center space-x-2"
                    >
                      <Camera size={16} />
                      <span>Open Camera QR Scanner</span>
                    </button>

                    <div className="pt-2 border-t border-border-subtle flex flex-col space-y-2 text-left">
                      <label className="text-xs font-medium text-text-secondary">Or Paste Pairing Code Manually:</label>
                      <textarea
                        rows={2}
                        placeholder="Paste code here..."
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-surface-muted border border-border-default rounded-xl focus:outline-none focus:border-accent-500 text-text-primary font-mono resize-none"
                      />
                      <button
                        onClick={() => processOfferToken(inputToken)}
                        disabled={!inputToken.trim() || isProcessing}
                        className="w-full py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
                      >
                        {isProcessing ? 'Processing...' : 'Submit Code'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setQrStep('idle');
                    setShowScanner(false);
                    setAnswerToken('');
                    setInputToken('');
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary self-center pt-1"
                >
                  &larr; Back
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 1-Click Fast Connect */}
        {!isConnected && activeTab === 'quick' && (
          <div className="flex flex-col space-y-3 py-2 text-center">
            <div className="p-4 rounded-2xl bg-surface-muted/60 border border-border-subtle flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center mb-1">
                <Zap size={24} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Direct Mesh Auto-Discovery</h3>
              <p className="text-xs text-text-secondary max-w-xs">
                Connects directly to nearby devices on the same Wi-Fi, Hotspot, or Bluetooth mesh channel with one click.
              </p>
              <button
                onClick={handleQuickConnect}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold shadow-subtle transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <Radio size={15} />
                <span>Connect Direct Offline Mesh</span>
              </button>
            </div>
          </div>
        )}

        {/* Security / Technology Badge */}
        <div className="flex items-center justify-center space-x-1.5 text-[11px] text-text-tertiary pt-2 border-t border-border-subtle">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Peer-to-peer authenticated with DTLS & SHA-256</span>
        </div>
      </div>
    </Modal>
  );
};

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
} from 'lucide-react';
import QRCode from 'qrcode';
import { offlineDirectChannel } from '../../../shared/lib/transport/offlineDirectChannel';
import { bluetoothTransport } from '../../../shared/lib/transport/bluetoothTransport';
import { BluetoothPeerDevice } from '../../../shared/lib/transport/types';
import { outboxManager } from '../../../shared/lib/outboxManager';

interface BluetoothScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothScanModal: React.FC<BluetoothScanModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'qr' | 'ble'>('quick');
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

  // Join QR Flow: Device B accepts Offer & generates Answer
  const handleAcceptOffer = async () => {
    if (!inputToken.trim()) return;
    setIsProcessing(true);
    try {
      const answer = await offlineDirectChannel.acceptPairingOffer(inputToken.trim());
      setAnswerToken(answer);
      const url = await QRCode.toDataURL(answer, { width: 220, margin: 1 });
      setQrDataUrl(url);
    } catch (e) {
      alert('Invalid pairing code. Please make sure the entire code is copied.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Host completes handshake by applying Answer
  const handleCompleteAnswer = async () => {
    if (!inputToken.trim()) return;
    setIsProcessing(true);
    try {
      const ok = await offlineDirectChannel.completePairing(inputToken.trim());
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
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Offline Direct P2P & Bluetooth">
      <div className="flex flex-col space-y-4">
        {/* Info Card */}
        <div className="flex items-start space-x-3 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs">
          <Bluetooth size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex flex-col space-y-1">
            <span className="font-semibold">Zero-Internet Direct Mesh</span>
            <p className="text-text-secondary leading-relaxed">
              Send, deliver, and view read receipts between two offline devices in real-time over direct Bluetooth / Local Hotspot P2P with zero internet required.
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
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'quick' ? 'bg-surface-elevated text-text-primary shadow-subtle' : 'text-text-secondary'
              }`}
            >
              1-Click Fast Pair
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'qr' ? 'bg-surface-elevated text-text-primary shadow-subtle' : 'text-text-secondary'
              }`}
            >
              QR / Token Pairing
            </button>
          </div>
        )}

        {/* TAB 1: 1-Click Fast Connect */}
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

        {/* TAB 2: QR / Handshake Token Flow */}
        {!isConnected && activeTab === 'qr' && (
          <div className="flex flex-col space-y-3">
            {qrStep === 'idle' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartHost}
                  disabled={isProcessing}
                  className="p-4 rounded-2xl border border-border-default bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center space-y-2 text-center transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent-500/10 text-accent-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <QrCode size={20} />
                  </div>
                  <span className="text-xs font-semibold text-text-primary">Device A: Host</span>
                  <span className="text-[10px] text-text-tertiary">Generate QR Code / Pairing Token</span>
                </button>

                <button
                  onClick={() => setQrStep('join')}
                  className="p-4 rounded-2xl border border-border-default bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center space-y-2 text-center transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Radio size={20} />
                  </div>
                  <span className="text-xs font-semibold text-text-primary">Device B: Join</span>
                  <span className="text-[10px] text-text-tertiary">Enter / Paste Device A's Code</span>
                </button>
              </div>
            )}

            {/* Host Step: Displaying Offer QR / Token */}
            {qrStep === 'host' && (
              <div className="flex flex-col items-center space-y-3 text-center">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-elevated">
                    <img src={qrDataUrl} alt="Pairing QR" className="w-44 h-44 rounded-xl" />
                  </div>
                ) : (
                  <div className="w-44 h-44 rounded-2xl bg-surface-muted flex items-center justify-center">
                    <RefreshCw size={24} className="animate-spin text-accent-500" />
                  </div>
                )}

                <div className="flex items-center space-x-2 w-full">
                  <button
                    onClick={() => handleCopy(offerToken)}
                    className="flex-1 py-2 px-3 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-border-default text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied Code!' : 'Copy Pairing Token'}</span>
                  </button>
                </div>

                <div className="w-full pt-2 border-t border-border-subtle flex flex-col space-y-2 text-left">
                  <label className="text-xs font-medium text-text-secondary">Paste Device B's Answer Token:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Paste answer token here..."
                      value={inputToken}
                      onChange={(e) => setInputToken(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-surface-muted border border-border-default rounded-xl focus:outline-none focus:border-accent-500 text-text-primary font-mono"
                    />
                    <button
                      onClick={handleCompleteAnswer}
                      disabled={!inputToken.trim() || isProcessing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Connect
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setQrStep('idle')}
                  className="text-xs text-text-tertiary hover:text-text-primary"
                >
                  &larr; Back
                </button>
              </div>
            )}

            {/* Join Step: Device B Enters Host Token */}
            {qrStep === 'join' && (
              <div className="flex flex-col space-y-3">
                {!answerToken ? (
                  <>
                    <label className="text-xs font-medium text-text-secondary">
                      Paste Device A's Pairing Token:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Paste Device A's pairing code here..."
                      value={inputToken}
                      onChange={(e) => setInputToken(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-surface-muted border border-border-default rounded-xl focus:outline-none focus:border-accent-500 text-text-primary font-mono resize-none"
                    />
                    <button
                      onClick={handleAcceptOffer}
                      disabled={!inputToken.trim() || isProcessing}
                      className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      {isProcessing ? 'Generating Answer...' : 'Generate Answer Code'}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="p-3 bg-white rounded-2xl shadow-elevated">
                      <img src={qrDataUrl!} alt="Answer QR" className="w-44 h-44 rounded-xl" />
                    </div>
                    <button
                      onClick={() => handleCopy(answerToken)}
                      className="w-full py-2 px-3 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-border-default text-xs font-medium flex items-center justify-center space-x-1.5"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied Answer!' : 'Copy Answer Token'}</span>
                    </button>
                    <p className="text-[11px] text-text-tertiary">
                      Paste this answer token back on Device A to complete the connection.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setQrStep('idle');
                    setAnswerToken('');
                    setInputToken('');
                  }}
                  className="text-xs text-text-tertiary hover:text-text-primary self-center"
                >
                  &larr; Back
                </button>
              </div>
            )}
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

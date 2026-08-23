import React, { useState, useEffect } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { Bluetooth, RefreshCw, WifiOff, Radio, ShieldCheck, ArrowRight } from 'lucide-react';
import { bluetoothTransport } from '../../../shared/lib/transport/bluetoothTransport';
import { BluetoothPeerDevice } from '../../../shared/lib/transport/types';
import { outboxManager } from '../../../shared/lib/outboxManager';

interface BluetoothScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothScanModal: React.FC<BluetoothScanModalProps> = ({ isOpen, onClose }) => {
  const [peers, setPeers] = useState<BluetoothPeerDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [connectedPeer, setConnectedPeer] = useState<BluetoothPeerDevice | null>(null);
  const [syncedCount, setSyncedCount] = useState<number>(0);

  const queuedCount = outboxManager.getQueuedCount();

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const discovered = await bluetoothTransport.scanForPeers();
      setPeers(discovered);
    } catch (e) {
      console.warn('Scan error:', e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleScan();
      const current = bluetoothTransport.getConnectedPeer();
      if (current) setConnectedPeer(current);
    }
  }, [isOpen]);

  const handleConnect = async (peer: BluetoothPeerDevice) => {
    setConnectingPeerId(peer.id);
    try {
      const success = await bluetoothTransport.connectToPeer(peer);
      if (success) {
        setConnectedPeer(peer);
        // If there are queued messages, try flushing them
        const queue = outboxManager.getQueue();
        if (queue.length > 0) {
          for (const item of queue) {
            await bluetoothTransport.send({
              clientId: item.clientId,
              conversationId: item.conversationId,
              senderId: item.optimisticMessage.senderId,
              content: item.content,
              type: item.type,
              media: item.media,
              replyToId: item.replyToId,
              sentAt: item.queuedAt,
            });
            outboxManager.dequeue(item.clientId);
            setSyncedCount((prev) => prev + 1);
          }
        }
      }
    } catch (e) {
      console.error('Connection error:', e);
    } finally {
      setConnectingPeerId(null);
    }
  };

  const handleDisconnect = () => {
    bluetoothTransport.disconnect();
    setConnectedPeer(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bluetooth Offline Mesh">
      <div className="flex flex-col space-y-4">
        {/* Info Card */}
        <div className="flex items-start space-x-3 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs">
          <Bluetooth size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex flex-col space-y-1">
            <span className="font-semibold">Direct Bluetooth Relay</span>
            <p className="text-text-secondary leading-relaxed">
              Send messages directly to nearby contacts even without internet or Wi-Fi. If your contact has internet, they will automatically relay your message to the Nexus cloud!
            </p>
          </div>
        </div>

        {/* Queued Outbox Notice */}
        {queuedCount > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
            <div className="flex items-center space-x-2">
              <WifiOff size={14} />
              <span>{queuedCount} message(s) queued for offline transfer</span>
            </div>
            {syncedCount > 0 && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {syncedCount} transferred!
              </span>
            )}
          </div>
        )}

        {/* Active Connected Peer Card */}
        {connectedPeer ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-pulse">
                <Radio size={16} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-text-primary">{connectedPeer.name}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Connected via Bluetooth</span>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-xs rounded-lg bg-surface-muted hover:bg-surface-elevated text-text-secondary transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : null}

        {/* Peer List */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Nearby Devices in Range</span>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center space-x-1 text-xs text-accent-500 hover:text-accent-600 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
              <span>{isScanning ? 'Scanning...' : 'Scan Nearby'}</span>
            </button>
          </div>

          <div className="flex flex-col space-y-1.5 max-h-56 overflow-y-auto">
            {peers.length > 0 ? (
              peers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border-default/60 hover:bg-surface-muted/60 transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <Bluetooth size={16} className="text-accent-500 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary">{peer.name}</span>
                      <span className="text-[10px] text-text-tertiary">Direct BLE Signal &bull; Strong</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConnect(peer)}
                    disabled={connectingPeerId === peer.id || connectedPeer?.id === peer.id}
                    className="flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span>{connectingPeerId === peer.id ? 'Connecting...' : connectedPeer?.id === peer.id ? 'Connected' : 'Pair & Sync'}</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-text-tertiary text-xs">
                <Radio size={24} className="mb-2 opacity-50" />
                <p>No Bluetooth peers found yet.</p>
                <p className="text-[11px] mt-1 opacity-75">Click "Scan Nearby" to search for contacts.</p>
              </div>
            )}
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center space-x-1.5 text-[11px] text-text-tertiary pt-2 border-t border-border-subtle">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Encrypted with SHA-256 integrity signatures</span>
        </div>
      </div>
    </Modal>
  );
};

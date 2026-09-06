import { localCache } from '../localCache';
import { outboxManager } from '../outboxManager';
import { BluetoothMessagePayload, BluetoothPeerDevice } from './types';

export type DirectPacketType =
  | 'MSG_SEND'
  | 'MSG_ACK_DELIVERED'
  | 'MSG_ACK_READ'
  | 'PEER_PING'
  | 'PEER_PONG';

export interface DirectPacket {
  type: DirectPacketType;
  packetId: string;
  payload?: any;
  senderId?: string;
  recipientId?: string;
  timestamp: string;
}

class OfflineDirectChannelManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectedPeer: BluetoothPeerDevice | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusListeners: Array<(connected: boolean, peer: BluetoothPeerDevice | null) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('nexus_offline_direct_mesh');
      this.broadcastChannel.onmessage = (event) => {
        const packet: DirectPacket = event.data;
        if (packet && packet.type) {
          this.handleInboundPacket(packet);
        }
      };
    }
  }

  public subscribeStatus(cb: (connected: boolean, peer: BluetoothPeerDevice | null) => void) {
    this.statusListeners.push(cb);
    cb(this.isConnected(), this.connectedPeer);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  private notifyStatus() {
    this.statusListeners.forEach((cb) => cb(this.isConnected(), this.connectedPeer));
  }

  public isConnected(): boolean {
    return (
      (this.dataChannel !== null && this.dataChannel.readyState === 'open') ||
      (this.connectedPeer !== null && this.connectedPeer.connected)
    );
  }

  public getConnectedPeer(): BluetoothPeerDevice | null {
    return this.connectedPeer;
  }

  // 1. Create Offline Pairing Offer (Device A - Host)
  public async createPairingOffer(): Promise<string> {
    this.close();

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.peerConnection = pc;

    const dc = pc.createDataChannel('nexus_offline_chat', { negotiated: true, id: 0 });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for local ICE candidates gathering (local LAN / mDNS candidates)
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 800); // 800ms max wait
      }
    });

    const offerToken = btoa(JSON.stringify(pc.localDescription));
    return offerToken;
  }

  // 2. Accept Offline Pairing Offer & Create Answer (Device B - Joiner)
  public async acceptPairingOffer(offerToken: string, peerName = 'Nearby Contact'): Promise<string> {
    this.close();

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.peerConnection = pc;

    const dc = pc.createDataChannel('nexus_offline_chat', { negotiated: true, id: 0 });
    this.setupDataChannel(dc);

    const offerDesc = JSON.parse(atob(offerToken));
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 800);
      }
    });

    this.connectedPeer = {
      id: 'peer-direct-' + Date.now(),
      name: peerName,
      connected: true,
      lastSeen: Date.now(),
    };
    this.notifyStatus();

    const answerToken = btoa(JSON.stringify(pc.localDescription));
    return answerToken;
  }

  // 3. Complete Pairing on Host (Device A applies Device B's answer)
  public async completePairing(answerToken: string, peerName = 'Nearby Contact'): Promise<boolean> {
    if (!this.peerConnection) return false;
    try {
      const answerDesc = JSON.parse(atob(answerToken));
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerDesc));

      this.connectedPeer = {
        id: 'peer-direct-' + Date.now(),
        name: peerName,
        connected: true,
        lastSeen: Date.now(),
      };
      this.notifyStatus();
      return true;
    } catch (e) {
      console.error('Failed to complete pairing:', e);
      return false;
    }
  }

  // Quick Local Simulated Peer Link (for multi-tab / same network testing)
  public connectLocalPeer(peerName = 'Nearby Contact (Bluetooth/P2P)') {
    this.connectedPeer = {
      id: 'sim-peer-' + Math.random().toString(36).substring(7),
      name: peerName,
      connected: true,
      lastSeen: Date.now(),
    };
    this.notifyStatus();
    console.log('⚡ Connected via Direct Offline Mesh');
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;
    dc.onopen = () => {
      console.log('🔗 Offline WebRTC DataChannel is OPEN');
      this.notifyStatus();
      // Auto-flush queued outbox messages
      this.flushOutbox();
    };

    dc.onclose = () => {
      console.log('🔌 Offline WebRTC DataChannel CLOSED');
      this.notifyStatus();
    };

    dc.onmessage = (event) => {
      try {
        const packet: DirectPacket = JSON.parse(event.data);
        this.handleInboundPacket(packet);
      } catch (err) {
        console.error('Error parsing DataChannel message:', err);
      }
    };
  }

  // Send Direct Packet (over DataChannel or BroadcastChannel)
  public sendPacket(packet: DirectPacket): boolean {
    const raw = JSON.stringify(packet);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(raw);
      return true;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(packet);
      return true;
    }

    return false;
  }

  // Send Chat Message via Direct Channel
  public async sendMessage(payload: BluetoothMessagePayload): Promise<boolean> {
    const packet: DirectPacket = {
      type: 'MSG_SEND',
      packetId: payload.clientId,
      payload,
      senderId: payload.senderId,
      recipientId: payload.recipientId,
      timestamp: payload.sentAt || new Date().toISOString(),
    };

    const sent = this.sendPacket(packet);
    if (sent) {
      console.log(`📤 Direct message sent [${payload.clientId}]: "${payload.content}"`);
    }
    return sent;
  }

  // Send Delivery Receipt
  public sendDeliveryReceipt(clientId: string, conversationId: string) {
    const packet: DirectPacket = {
      type: 'MSG_ACK_DELIVERED',
      packetId: clientId,
      payload: { clientId, conversationId, deliveredAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    };
    this.sendPacket(packet);
  }

  // Send Read Receipt
  public sendReadReceipt(clientId: string, conversationId: string) {
    const packet: DirectPacket = {
      type: 'MSG_ACK_READ',
      packetId: clientId,
      payload: { clientId, conversationId, readAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    };
    this.sendPacket(packet);
  }

  // Inbound Packet Processing
  private handleInboundPacket(packet: DirectPacket) {
    console.log(`📥 Inbound direct packet received: ${packet.type} [${packet.packetId}]`);

    // 1. Inbound Chat Message
    if (packet.type === 'MSG_SEND' && packet.payload) {
      const msg: BluetoothMessagePayload = packet.payload;

      // Save to local cache
      localCache.appendMessage(msg.conversationId, {
        id: msg.clientId,
        clientId: msg.clientId,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        seqNo: 999999,
        type: (msg.type as any) || 'text',
        content: msg.content,
        media: msg.media,
        replyTo: msg.replyToId ? { messageId: msg.replyToId, senderId: '', content: '', type: 'text' } : null,
        reactions: [],
        status: {
          delivered: [{ userId: msg.recipientId || 'peer', at: new Date().toISOString() }],
          read: [],
        },
        sentAt: msg.sentAt || new Date().toISOString(),
        transportType: 'bluetooth',
        deliveryState: 'BLUETOOTH_RECEIVED',
      });

      localCache.updateConversationLastMessage(msg.conversationId, {
        content: msg.content,
        sentAt: msg.sentAt || new Date().toISOString(),
        senderId: msg.senderId,
        type: msg.type || 'text',
      });

      // Send immediate Delivery Ack back to sender!
      this.sendDeliveryReceipt(msg.clientId, msg.conversationId);
      window.dispatchEvent(new CustomEvent('nexus_direct_message_received', { detail: msg }));
    }

    // 2. Inbound Delivery Receipt (Double Gray Check ✔️✔️)
    else if (packet.type === 'MSG_ACK_DELIVERED' && packet.payload) {
      const { clientId, conversationId, deliveredAt } = packet.payload;
      console.log(`✅ Direct delivery confirmed for message [${clientId}]`);

      // Update in localCache
      const msgs = localCache.getMessages(conversationId);
      const updated = msgs.map((m) => {
        if (m.clientId === clientId || m.id === clientId) {
          return {
            ...m,
            isOptimistic: false,
            deliveryState: 'DELIVERED' as const,
            status: {
              ...m.status,
              delivered: [{ userId: 'peer', at: deliveredAt || new Date().toISOString() }],
            },
          };
        }
        return m;
      });
      localCache.setMessages(conversationId, updated);
      window.dispatchEvent(
        new CustomEvent('nexus_message_delivered', {
          detail: { clientId, conversationId, deliveredAt },
        })
      );
    }

    // 3. Inbound Read Receipt (Double Blue Check)
    else if (packet.type === 'MSG_ACK_READ' && packet.payload) {
      const { clientId, conversationId, readAt } = packet.payload;
      console.log(`👁️ Direct read receipt confirmed for message [${clientId}]`);

      const msgs = localCache.getMessages(conversationId);
      const updated = msgs.map((m) => {
        if (m.clientId === clientId || m.id === clientId) {
          return {
            ...m,
            isOptimistic: false,
            deliveryState: 'READ' as const,
            status: {
              ...m.status,
              read: [{ userId: 'peer', at: readAt || new Date().toISOString() }],
            },
          };
        }
        return m;
      });
      localCache.setMessages(conversationId, updated);
      window.dispatchEvent(
        new CustomEvent('nexus_message_read', {
          detail: { clientId, conversationId, readAt },
        })
      );
    }
  }

  // Flush Outbox over Direct Channel
  public async flushOutbox() {
    const queue = outboxManager.getQueue();
    if (queue.length === 0) return;

    console.log(`📤 Flushing ${queue.length} outbox messages over Direct Channel...`);
    for (const item of queue) {
      const success = await this.sendMessage({
        clientId: item.clientId,
        conversationId: item.conversationId,
        senderId: item.optimisticMessage.senderId,
        content: item.content,
        type: item.type,
        media: item.media,
        replyToId: item.replyToId,
        sentAt: item.queuedAt,
      });

      if (success) {
        outboxManager.dequeue(item.clientId);
      }
    }
  }

  public close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.connectedPeer = null;
    this.notifyStatus();
  }
}

export const offlineDirectChannel = new OfflineDirectChannelManager();

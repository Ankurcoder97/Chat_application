import { getSocket } from '../../../socket/socketClient';
import api from '../axios';
import { localCache } from '../localCache';
import { outboxManager } from '../outboxManager';
import { bluetoothTransport } from './bluetoothTransport';
import { BluetoothMessagePayload, DeliveryState, TransportType } from './types';

class TransportManager {
  constructor() {
    // Register listener for incoming Bluetooth messages
    bluetoothTransport.setOnMessageReceived((message) => {
      this.handleInboundBluetoothMessage(message);
    });
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public getActiveTransport(): TransportType {
    if (this.isOnline() && getSocket()?.connected) {
      return 'internet';
    }
    if (bluetoothTransport.isAvailable()) {
      return 'bluetooth';
    }
    return 'offline_queue';
  }

  // Send message using the best available transport
  public async dispatchMessage(payload: BluetoothMessagePayload): Promise<{
    transport: TransportType;
    deliveryState: DeliveryState;
  }> {
    const transport = this.getActiveTransport();

    // 1. Internet Transport (Socket / REST)
    if (transport === 'internet') {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('message:send', {
          clientId: payload.clientId,
          conversationId: payload.conversationId,
          content: payload.content,
          type: payload.type,
          media: payload.media,
          replyToId: payload.replyToId,
        });
        return { transport: 'internet', deliveryState: 'SERVER_SYNCED' };
      }
    }

    // 2. Bluetooth Transport (Device A -> Device B)
    if (transport === 'bluetooth') {
      const success = await bluetoothTransport.send(payload);
      if (success) {
        return { transport: 'bluetooth', deliveryState: 'BLUETOOTH_TRANSFER' };
      }
    }

    // 3. Fallback to Local Offline Outbox Queue
    return { transport: 'offline_queue', deliveryState: 'PENDING_LOCAL' };
  }

  // Handle incoming message received over Bluetooth (Relay Node / Device B logic)
  public async handleInboundBluetoothMessage(message: BluetoothMessagePayload) {
    console.log(`📡 Inbound Bluetooth message received from [${message.senderId}]: "${message.content}"`);

    // 1. Persist to local cache immediately
    localCache.appendMessage(message.conversationId, {
      id: message.clientId,
      clientId: message.clientId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      seqNo: 999999,
      type: (message.type as any) || 'text',
      content: message.content,
      media: message.media,
      replyTo: message.replyToId ? { messageId: message.replyToId, senderId: '', content: '', type: 'text' } : null,
      reactions: [],
      status: { delivered: [], read: [] },
      sentAt: message.sentAt || new Date().toISOString(),
      transportType: 'bluetooth',
      deliveryState: 'BLUETOOTH_RECEIVED',
    });

    localCache.updateConversationLastMessage(message.conversationId, {
      content: message.content,
      sentAt: message.sentAt || new Date().toISOString(),
      senderId: message.senderId,
      type: message.type || 'text',
    });

    // 2. If Device B has active Internet connection, relay to backend /messages/sync immediately!
    if (this.isOnline()) {
      await this.relayMessageToServer(message);
    } else {
      // Queue in outbox for subsequent relay when internet becomes available
      outboxManager.enqueue({
        clientId: message.clientId,
        conversationId: message.conversationId,
        content: message.content,
        type: (message.type as any) || 'text',
        media: message.media,
        replyToId: message.replyToId,
        queuedAt: message.sentAt,
        retryCount: 0,
        optimisticMessage: {
          id: message.clientId,
          clientId: message.clientId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          seqNo: 999999,
          type: (message.type as any) || 'text',
          content: message.content,
          media: message.media,
          reactions: [],
          status: { delivered: [], read: [] },
          sentAt: message.sentAt,
          transportType: 'bluetooth',
          deliveryState: 'SYNC_PENDING',
        },
      });
    }
  }

  // Relay Bluetooth message to cloud backend API
  public async relayMessageToServer(message: BluetoothMessagePayload): Promise<boolean> {
    try {
      console.log(`☁️ Relaying Bluetooth message [${message.clientId}] to Nexus Backend...`);
      const { data } = await api.post('/messages/sync', {
        messages: [
          {
            clientId: message.clientId,
            conversationId: message.conversationId,
            senderId: message.senderId,
            recipientId: message.recipientId,
            content: message.content,
            type: message.type,
            media: message.media,
            replyToId: message.replyToId,
            sentAt: message.sentAt,
            transportType: 'bluetooth',
            signature: message.signature,
          },
        ],
      });

      if (data?.success && data.data?.synced?.length > 0) {
        const syncAck = data.data.synced[0];
        console.log(`✅ Bluetooth message [${message.clientId}] synced to Cloud as Server ID [${syncAck.serverId}]`);
        localCache.updateMessageStatus(
          message.conversationId,
          message.clientId,
          syncAck.serverId,
          syncAck.sentAt,
          syncAck.seqNo
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to relay Bluetooth message to server:', err);
      return false;
    }
  }
}

export const transportManager = new TransportManager();

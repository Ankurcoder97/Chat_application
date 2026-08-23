import { getSocket } from '../../socket/socketClient';
import api from './axios';
import { localCache } from './localCache';
import { Message } from '../types';

export interface OutboxItem {
  clientId: string;
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document';
  media?: any;
  replyToId?: string;
  queuedAt: string;
  retryCount: number;
  optimisticMessage: Message;
}

const OUTBOX_STORAGE_KEY = 'nexus_outbox_queue';

class OutboxManager {
  private queue: OutboxItem[] = [];
  private isFlushing = false;
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadQueue();

    // Auto-listen to browser online / offline state
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network online detected, flushing outbox...');
        this.flushQueue();
      });

      window.addEventListener('offline', () => {
        console.log('🔌 Network offline detected');
        this.notify();
      });
    }
  }

  private loadQueue() {
    try {
      const data = localStorage.getItem(OUTBOX_STORAGE_KEY);
      this.queue = data ? JSON.parse(data) : [];
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to save outbox queue', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public getQueue(): OutboxItem[] {
    return [...this.queue];
  }

  public getQueuedMessages(conversationId: string): Message[] {
    return this.queue
      .filter((item) => item.conversationId === conversationId)
      .map((item) => item.optimisticMessage);
  }

  public getQueuedCount(): number {
    return this.queue.length;
  }

  public enqueue(item: OutboxItem) {
    // Avoid duplicate enqueue for same clientId
    const exists = this.queue.some((i) => i.clientId === item.clientId);
    if (!exists) {
      this.queue.push(item);
      this.saveQueue();
    }

    // Also persist optimistic message to local conversation cache
    localCache.appendMessage(item.conversationId, item.optimisticMessage);
    localCache.updateConversationLastMessage(item.conversationId, {
      content: item.content,
      sentAt: item.queuedAt,
      senderId: item.optimisticMessage.senderId,
      type: item.type,
    });

    // If online, try flushing immediately
    if (this.isOnline()) {
      this.flushQueue();
    }
  }

  public dequeue(clientId: string) {
    this.queue = this.queue.filter((i) => i.clientId !== clientId);
    this.saveQueue();
  }

  // Sequentially flush all queued messages when online
  public async flushQueue() {
    if (this.isFlushing || this.queue.length === 0 || !this.isOnline()) {
      return;
    }

    this.isFlushing = true;
    console.log(`📤 Flushing ${this.queue.length} queued offline messages...`);

    const itemsToSend = [...this.queue];

    for (const item of itemsToSend) {
      try {
        const socket = getSocket();
        let sentSuccessfully = false;

        if (socket && socket.connected) {
          // Send via Socket
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket send timeout')), 7000);

            socket.emit(
              'message:send',
              {
                clientId: item.clientId,
                conversationId: item.conversationId,
                content: item.content,
                type: item.type,
                media: item.media,
                replyToId: item.replyToId,
              },
              (res: any) => {
                clearTimeout(timeout);
                if (res?.error) {
                  reject(new Error(res.error));
                } else {
                  sentSuccessfully = true;
                  resolve();
                }
              }
            );
          });
        } else {
          // Fallback via REST endpoint
          const res = await api.post(`/conversations/${item.conversationId}/messages`, {
            clientId: item.clientId,
            content: item.content,
            type: item.type,
            media: item.media,
            replyToId: item.replyToId,
          });

          if (res.data?.success) {
            sentSuccessfully = true;
          }
        }

        if (sentSuccessfully) {
          console.log(`✅ Queued message [${item.clientId}] sent successfully`);
          this.dequeue(item.clientId);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to send queued message [${item.clientId}], will retry later`, err);
        item.retryCount = (item.retryCount || 0) + 1;
        this.saveQueue();
        // If we hit a network failure, stop flushing until next network event
        if (!this.isOnline()) {
          break;
        }
      }
    }

    this.isFlushing = false;
  }
}

export const outboxManager = new OutboxManager();

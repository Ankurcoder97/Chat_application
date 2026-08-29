import { Conversation, Message } from '../types';

const CONVERSATIONS_CACHE_KEY = 'nexus_cached_conversations';
const MESSAGES_CACHE_PREFIX = 'nexus_cached_messages_';

export const localCache = {
  // 1. Conversations
  getConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(CONVERSATIONS_CACHE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setConversations(conversations: Conversation[]) {
    try {
      localStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn('Failed to save conversations cache', e);
    }
  },

  updateConversationLastMessage(
    conversationId: string,
    lastMessage: { content: string; sentAt: string; senderId?: any; type: string }
  ) {
    try {
      const convs = this.getConversations();
      const updated = convs.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            lastMessage: {
              id: 'temp-' + Date.now(),
              content: lastMessage.content,
              sentAt: lastMessage.sentAt,
              senderId: lastMessage.senderId,
              type: (lastMessage.type as any) || 'text',
            },
            lastMessageAt: lastMessage.sentAt,
          };
        }
        return c;
      });

      // Sort by lastMessageAt descending
      updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      this.setConversations(updated);
    } catch (e) {
      console.warn('Failed to update conversation last message in cache', e);
    }
  },

  // 2. Messages per Conversation
  getMessages(conversationId: string): Message[] {
    try {
      const data = localStorage.getItem(`${MESSAGES_CACHE_PREFIX}${conversationId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setMessages(conversationId: string, messages: Message[]) {
    try {
      // Keep most recent 100 messages per conversation in local storage
      const trimmed = messages.slice(-100);
      localStorage.setItem(`${MESSAGES_CACHE_PREFIX}${conversationId}`, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to save messages cache', e);
    }
  },

  appendMessage(conversationId: string, message: Message) {
    try {
      const current = this.getMessages(conversationId);
      const exists = current.some((m) => m.clientId === message.clientId || m.id === message.id);
      if (!exists) {
        const updated = [...current, message];
        this.setMessages(conversationId, updated);
      }
    } catch (e) {
      console.warn('Failed to append message to cache', e);
    }
  },

  updateMessageStatus(
    conversationId: string,
    clientId: string,
    serverId: string,
    sentAt: string,
    seqNo?: number
  ) {
    try {
      const current = this.getMessages(conversationId);
      const updated = current.map((m) => {
        if (m.clientId === clientId || m.id === clientId) {
          return {
            ...m,
            id: serverId || m.id,
            sentAt: sentAt || m.sentAt,
            seqNo: seqNo || m.seqNo,
            isOptimistic: false,
            hasError: false,
          };
        }
        return m;
      });
      this.setMessages(conversationId, updated);
    } catch (e) {
      console.warn('Failed to update message status in cache', e);
    }
  },

  updateMessageDeliveryStatus(
    conversationId: string,
    messageId: string,
    userId: string,
    deliveredAt?: string
  ) {
    try {
      const current = this.getMessages(conversationId);
      const updated = current.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            status: {
              ...m.status,
              delivered: [
                ...(m.status?.delivered || []).filter((d: any) => d.userId !== userId),
                { userId, at: deliveredAt || new Date().toISOString() },
              ],
            },
          };
        }
        return m;
      });
      this.setMessages(conversationId, updated);
    } catch (e) {
      console.warn('Failed to update message delivery status in cache', e);
    }
  },

  updateMessageReadStatus(
    conversationId: string,
    userId: string,
    readAt?: string,
    lastReadMessageId?: string
  ) {
    try {
      const current = this.getMessages(conversationId);
      const updated = current.map((m) => {
        // Mark messages as read up to the lastReadMessageId
        const shouldMarkRead =
          !lastReadMessageId ||
          m.id === lastReadMessageId ||
          (m.seqNo &&
            m.seqNo <=
              (current.find((msg) => msg.id === lastReadMessageId)?.seqNo || 0));

        if (shouldMarkRead && m.senderId !== userId) {
          return {
            ...m,
            status: {
              ...m.status,
              read: [
                ...(m.status?.read || []).filter((r: any) => r.userId !== userId),
                { userId, at: readAt || new Date().toISOString() },
              ],
            },
          };
        }
        return m;
      });
      this.setMessages(conversationId, updated);
    } catch (e) {
      console.warn('Failed to update message read status in cache', e);
    }
  },
};

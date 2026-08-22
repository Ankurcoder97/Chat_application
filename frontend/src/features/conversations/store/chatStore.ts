import { create } from 'zustand';
import { Conversation, ReplyTo } from '../../../shared/types';

interface ChatState {
  activeConversation: Conversation | null;
  replyTo: ReplyTo | null;
  onlineUsers: Set<string>;
  typingUsers: Record<string, string>; // conversationId -> typing username
  searchQuery: string;

  setActiveConversation: (conversation: Conversation | null) => void;
  setReplyTo: (reply: ReplyTo | null) => void;
  setSearchQuery: (query: string) => void;

  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setTyping: (conversationId: string, username: string) => void;
  clearTyping: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversation: null,
  replyTo: null,
  onlineUsers: new Set<string>(),
  typingUsers: {},
  searchQuery: '',

  setActiveConversation: (conversation) => set({ activeConversation: conversation, replyTo: null }),
  setReplyTo: (replyTo) => set({ replyTo }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setUserOnline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.add(userId);
      return { onlineUsers: updated };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUsers);
      updated.delete(userId);
      return { onlineUsers: updated };
    }),

  setTyping: (conversationId, username) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [conversationId]: username },
    })),

  clearTyping: (conversationId) =>
    set((state) => {
      const next = { ...state.typingUsers };
      delete next[conversationId];
      return { typingUsers: next };
    }),
}));

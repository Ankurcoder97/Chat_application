import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../conversations/store/chatStore';
import { useAuthStore } from '../../auth/store/authStore';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Message } from '../../../shared/types';
import { MessageSquare, ShieldCheck, WifiOff } from 'lucide-react';
import api from '../../../shared/lib/axios';
import { format, isSameDay, parseISO } from 'date-fns';
import { localCache } from '../../../shared/lib/localCache';
import { outboxManager } from '../../../shared/lib/outboxManager';

export const ChatView: React.FC = () => {
  const { activeConversation, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const conversationId = activeConversation?.id;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data, isLoading } = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return { messages: [], hasMore: false };
      try {
        const { data } = await api.get(`/conversations/${conversationId}/messages`);
        const serverMessages: Message[] = data.data.messages || [];

        // Save fresh messages to local offline cache
        localCache.setMessages(conversationId, serverMessages);

        return data.data;
      } catch (err) {
        console.warn('Network error fetching messages, loading from offline cache', err);
        const cachedMessages = localCache.getMessages(conversationId);
        return { messages: cachedMessages, hasMore: false };
      }
    },
    initialData: () => {
      if (!conversationId) return undefined;
      // Load from cache and merge with outbox queue, sorted by sentAt
      const cached = localCache.getMessages(conversationId);
      const queued = outboxManager.getQueuedMessages(conversationId);
      
      // Merge and deduplicate
      const merged: Message[] = [];
      const seen = new Set<string>();
      
      [...cached, ...queued].forEach((m) => {
        const key = m.clientId || m.id;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(m);
        }
      });
      
      // Sort by sentAt time
      merged.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      
      return merged.length > 0 ? { messages: merged, hasMore: false } : undefined;
    },
    enabled: !!conversationId,
  });

  const messages = data?.messages || [];
  const isRecipientTyping = conversationId ? typingUsers[conversationId] : null;

  // Scroll directly to the bottom of the container
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    if (behavior === 'smooth') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  // When changing conversation, reset initial load flag
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [conversationId]);

  // When messages load or update, scroll to bottom
  useLayoutEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoadRef.current) {
        scrollToBottom('auto');
        requestAnimationFrame(() => scrollToBottom('auto'));
        setTimeout(() => scrollToBottom('auto'), 50);
        isInitialLoadRef.current = false;
      } else {
        scrollToBottom('smooth');
      }
    }
  }, [messages, isRecipientTyping]);

  if (!activeConversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-surface-chat select-none text-center p-8 h-full">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center text-accent-500 shadow-subtle mb-4">
          <MessageSquare size={32} />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Nexus Web & Mobile</h2>
        <p className="text-sm text-text-secondary mt-1.5 max-w-sm">
          Send and receive messages with zero lag. Select a chat from the sidebar or start a new conversation.
        </p>
        <div className="flex items-center space-x-1.5 mt-8 text-xs text-text-tertiary">
          <ShieldCheck size={14} className="text-accent-500" />
          <span>Real-time delivery with end-to-end sync</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full w-full min-h-0 bg-surface-chat overflow-hidden relative">
      {/* Header: pinned strictly to top */}
      <ChatHeader />

      {/* Offline Status Warning Bar */}
      {isOffline && (
        <div className="flex items-center justify-center space-x-2 bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 py-1.5 px-3 text-xs border-b border-amber-500/20 z-20 flex-shrink-0 animate-message-in">
          <WifiOff size={13} className="flex-shrink-0" />
          <span>Offline mode &bull; Messages will be sent automatically when back online</span>
        </div>
      )}

      {/* Message Stream: isolated scroll container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 flex flex-col space-y-1.5 overscroll-contain"
      >
        {/* Security / Info Banner */}
        <div className="self-center my-1.5 px-3 py-1 bg-surface-elevated/80 backdrop-blur-sm rounded-lg text-[11px] text-text-tertiary border border-border-subtle shadow-subtle select-none">
          🔒 Messages are encrypted in transit and securely synced.
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-end space-y-3 p-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`w-48 h-12 rounded-2xl skeleton ${n % 2 === 0 ? 'self-end' : 'self-start'}`}
              />
            ))}
          </div>
        ) : messages.length > 0 ? (
          messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const isNewDay =
              !prevMessage || !isSameDay(parseISO(prevMessage.sentAt), parseISO(message.sentAt));

            return (
              <React.Fragment key={message.id || message.clientId}>
                {isNewDay && (
                  <div className="self-center my-2.5 px-3 py-0.5 bg-surface-elevated/90 rounded-full text-[11px] font-medium text-text-secondary border border-border-subtle shadow-subtle select-none">
                    {format(parseISO(message.sentAt), 'MMMM d, yyyy')}
                  </div>
                )}
                <MessageBubble message={message} currentUser={user} />
              </React.Fragment>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
            <p className="text-sm font-medium text-text-primary">
              Say hello to {activeConversation.participant?.name}! 👋
            </p>
            <p className="text-xs text-text-secondary mt-1">Send a message to start this conversation.</p>
          </div>
        )}

        {/* Typing Indicator */}
        {isRecipientTyping && (
          <div className="self-start flex items-center space-x-1 px-3.5 py-2 bg-surface-elevated rounded-bubble-recv border border-border-subtle/70 shadow-subtle mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-3" />
          </div>
        )}
      </div>

      {/* Composer: pinned strictly to bottom */}
      <div className="flex-shrink-0 w-full z-20">
        <MessageComposer />
      </div>
    </div>
  );
};

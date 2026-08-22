import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../conversations/store/chatStore';
import { useAuthStore } from '../../auth/store/authStore';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Message } from '../../../shared/types';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import api from '../../../shared/lib/axios';
import { format, isSameDay, parseISO } from 'date-fns';

export const ChatView: React.FC = () => {
  const { activeConversation, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversationId = activeConversation?.id;

  const { data, isLoading } = useQuery<{ messages: Message[]; hasMore: boolean }>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return { messages: [], hasMore: false };
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      return data.data;
    },
    enabled: !!conversationId,
  });

  const messages = data?.messages || [];
  const isRecipientTyping = conversationId ? typingUsers[conversationId] : null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isRecipientTyping]);

  if (!activeConversation) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-surface-chat select-none text-center p-8">
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
    <div className="flex flex-1 flex-col h-full bg-surface-chat overflow-hidden">
      {/* Header */}
      <ChatHeader />

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-1">
        {/* Security / Info Banner */}
        <div className="self-center my-2 px-3 py-1 bg-surface-elevated/70 backdrop-blur-sm rounded-lg text-[11px] text-text-tertiary border border-border-subtle shadow-subtle select-none">
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
                  <div className="self-center my-3 px-3 py-0.5 bg-surface-elevated/80 rounded-full text-[11px] font-medium text-text-secondary border border-border-subtle shadow-subtle select-none">
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
          <div className="self-start flex items-center space-x-1 px-3.5 py-2 bg-surface-elevated rounded-bubble-recv border border-border-subtle/70 shadow-subtle mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 typing-dot-3" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer />
    </div>
  );
};

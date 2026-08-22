import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './socketClient';
import { useAuthStore } from '../features/auth/store/authStore';
import { useChatStore } from '../features/conversations/store/chatStore';
import { Message, Conversation } from '../shared/types';
import { useCallStore } from '../features/calls/store/callStore';
import { webrtc } from '../shared/lib/webrtc';

export function useSocketEvents() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { activeConversation, setUserOnline, setUserOffline, setTyping, clearTyping } = useChatStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    // 1. New Message Received
    const handleNewMessage = (newMessage: Message) => {
      const convId = newMessage.conversationId;

      // Update Messages Cache for this conversation
      queryClient.setQueryData(['messages', convId], (oldData: any) => {
        if (!oldData) return { messages: [newMessage], hasMore: false };
        // Check if message is already in list (e.g. optimistic match by clientId)
        const exists = oldData.messages.some(
          (m: Message) => m.id === newMessage.id || (m.clientId && m.clientId === newMessage.clientId)
        );
        if (exists) {
          return {
            ...oldData,
            messages: oldData.messages.map((m: Message) =>
              m.clientId === newMessage.clientId || m.id === newMessage.id ? newMessage : m
            ),
          };
        }
        return {
          ...oldData,
          messages: [...oldData.messages, newMessage],
        };
      });

      // Update Conversation List (lastMessage & unreadCount)
      queryClient.setQueryData(['conversations'], (oldConvs: Conversation[] | undefined) => {
        if (!oldConvs) return oldConvs;
        return oldConvs
          .map((c) => {
            if (c.id === convId) {
              const isCurrentChat = activeConversation?.id === convId;
              return {
                ...c,
                lastMessage: {
                  id: newMessage.id,
                  content: newMessage.content || `[${newMessage.type}]`,
                  type: newMessage.type,
                  sentAt: newMessage.sentAt,
                  senderId: newMessage.senderId,
                },
                lastMessageAt: newMessage.sentAt,
                unreadCount: isCurrentChat ? 0 : c.unreadCount + 1,
              };
            }
            return c;
          })
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });

      // If active conversation, emit message:read and message:delivered
      if (activeConversation?.id === convId && newMessage.senderId !== user.id) {
        socket.emit('message:read', { conversationId: convId, lastReadMessageId: newMessage.id });
      } else if (newMessage.senderId !== user.id) {
        socket.emit('message:delivered', { messageId: newMessage.id, conversationId: convId });
      }
    };

    // 2. Message Ack (Replaces optimistic message with server message)
    const handleMessageAck = ({ clientId, serverId, sentAt, seqNo }: any) => {
      if (!activeConversation) return;
      queryClient.setQueryData(['messages', activeConversation.id], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((m: Message) =>
            m.clientId === clientId
              ? { ...m, id: serverId, sentAt, seqNo, isOptimistic: false, hasError: false }
              : m
          ),
        };
      });
    };

    // 3. Delivered Status Update
    const handleDelivered = ({ messageId, conversationId }: any) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((m: Message) =>
            m.id === messageId
              ? { ...m, status: { ...m.status, delivered: [{ userId: 'recipient', at: new Date().toISOString() }] } }
              : m
          ),
        };
      });
    };

    // 4. Read Status Update
    const handleRead = ({ conversationId }: any) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((m: Message) => ({
            ...m,
            status: {
              ...m.status,
              read: [{ userId: 'recipient', at: new Date().toISOString() }],
            },
          })),
        };
      });
    };

    // 5. Typing Indicators
    const handleTypingStart = ({ conversationId, username }: any) => {
      setTyping(conversationId, username);
    };

    const handleTypingStop = ({ conversationId }: any) => {
      clearTyping(conversationId);
    };

    // 6. Presence Indicators
    const handlePresenceOnline = ({ userId }: any) => {
      setUserOnline(userId);
    };

    const handlePresenceOffline = ({ userId }: any) => {
      setUserOffline(userId);
    };

    // 7. Reaction Updated
    const handleReactionUpdated = ({ messageId, conversationId, reactions }: any) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((m: Message) => (m.id === messageId ? { ...m, reactions } : m)),
        };
      });
    };

    // 8. WebRTC Call Events
    const handleCallIncoming = ({ callId, caller, callType }: any) => {
      useCallStore.getState().receiveIncomingCall(callId, caller, callType);
    };

    const handleCallAccepted = () => {
      useCallStore.getState().onCallAccepted();
    };

    const handleCallRejected = () => {
      useCallStore.getState().rejectCall();
    };

    const handleCallSignal = ({ callId, senderId, signalData }: any) => {
      const store = useCallStore.getState();
      if (signalData.type === 'offer') {
        store.setIncomingOffer(signalData.sdp);
        if (store.callStatus === 'connected' && store.peer) {
          webrtc.handleOfferAndAnswer(
            callId || store.callId,
            senderId || store.peer.id,
            signalData.sdp,
            store.callType
          );
        }
      } else {
        webrtc.handleSignal(signalData);
      }
    };

    const handleCallEnded = () => {
      useCallStore.getState().onCallEnded();
    };

    // Register listeners
    socket.on('message:new', handleNewMessage);
    socket.on('message:ack', handleMessageAck);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:read', handleRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('presence:online', handlePresenceOnline);
    socket.on('presence:offline', handlePresenceOffline);
    socket.on('reaction:updated', handleReactionUpdated);
    socket.on('call:incoming', handleCallIncoming);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:signal', handleCallSignal);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:ack', handleMessageAck);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:read', handleRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('presence:online', handlePresenceOnline);
      socket.off('presence:offline', handlePresenceOffline);
      socket.off('reaction:updated', handleReactionUpdated);
      socket.off('call:incoming', handleCallIncoming);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:signal', handleCallSignal);
      socket.off('call:ended', handleCallEnded);
    };
  }, [user, activeConversation, queryClient, setUserOnline, setUserOffline, setTyping, clearTyping]);
}

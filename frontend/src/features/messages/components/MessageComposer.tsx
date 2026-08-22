import React, { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Mic, Send, X, Image as ImageIcon, FileText, Music } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore } from '../../conversations/store/chatStore';
import { useAuthStore } from '../../auth/store/authStore';
import { VoiceRecorder } from './VoiceRecorder';
import api from '../../../shared/lib/axios';
import { getSocket } from '../../../socket/socketClient';
import { useQueryClient } from '@tanstack/react-query';
import { Message } from '../../../shared/types';

const COMMON_EMOJIS = ['😊', '😂', '🔥', '❤️', '👍', '🙏', '🎉', '✨', '👋', '😍', '🤔', '🙌', '🚀', '💯'];

export const MessageComposer: React.FC = () => {
  const { activeConversation, replyTo, setReplyTo } = useChatStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const socket = getSocket();
    if (!socket || !activeConversation || !activeConversation.participant) return;

    socket.emit('typing:start', {
      conversationId: activeConversation.id,
      recipientId: activeConversation.participant.id,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: activeConversation.id,
        recipientId: activeConversation.participant?.id,
      });
    }, 2500);
  };

  const handleSend = (mediaPayload?: any, type: any = 'text') => {
    if (!text.trim() && !mediaPayload) return;
    if (!activeConversation || !user) return;

    const clientId = uuidv4();
    const content = text.trim();
    const convId = activeConversation.id;

    const optimisticMessage: Message = {
      id: clientId,
      clientId,
      conversationId: convId,
      senderId: user.id,
      sender: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
      seqNo: 999999, // temporary seqNo until server acks
      type: mediaPayload ? type : 'text',
      content,
      media: mediaPayload || null,
      replyTo: replyTo || null,
      reactions: [],
      status: { delivered: [], read: [] },
      sentAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // 1. Optimistic update
    queryClient.setQueryData(['messages', convId], (old: any) => {
      if (!old) return { messages: [optimisticMessage], hasMore: false };
      return { ...old, messages: [...old.messages, optimisticMessage] };
    });

    // 2. Emit via socket (or REST fallback)
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('message:send', {
        clientId,
        conversationId: convId,
        content,
        type: mediaPayload ? type : 'text',
        media: mediaPayload,
        replyToId: replyTo?.messageId,
      });
    } else {
      // REST fallback
      api.post(`/conversations/${convId}/messages`, {
        clientId,
        content,
        type: mediaPayload ? type : 'text',
        media: mediaPayload,
        replyToId: replyTo?.messageId,
      });
    }

    setText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachmentMenu(false);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const media = data.data;
      handleSend(media, media.type);
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isRecordingVoice) {
    return (
      <div className="p-2.5 sm:p-3 bg-surface-base border-t border-border-subtle">
        <VoiceRecorder
          onSendVoice={(voiceData) => {
            setIsRecordingVoice(false);
            handleSend(voiceData, 'voice');
          }}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col p-2 sm:p-3 bg-surface-base/95 backdrop-blur-md border-t border-border-subtle select-none z-30 flex-shrink-0">
      {/* Reply-To Preview Banner */}
      {replyTo && (
        <div className="flex items-center justify-between px-3 py-2 mb-2 bg-surface-muted border-l-4 border-l-accent-500 rounded-xl text-xs animate-message-in">
          <div className="flex flex-col truncate">
            <span className="font-semibold text-accent-600 dark:text-accent-400">Replying to message</span>
            <span className="text-text-secondary truncate">{replyTo.content}</span>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-elevated"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 sm:left-4 z-40 bg-surface-elevated border border-border-default rounded-2xl p-3 shadow-elevated grid grid-cols-7 gap-2 animate-message-in">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setText((prev) => prev + emoji)}
              className="p-1.5 text-xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachmentMenu && (
        <div className="absolute bottom-16 left-10 sm:left-12 z-40 bg-surface-elevated border border-border-default rounded-2xl p-2 shadow-elevated flex flex-col space-y-1 w-44 text-xs animate-message-in">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-surface-muted transition-colors text-left"
          >
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <ImageIcon size={16} />
            </div>
            <span>Photos & Videos</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-surface-muted transition-colors text-left"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <FileText size={16} />
            </div>
            <span>Document</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-surface-muted transition-colors text-left"
          >
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Music size={16} />
            </div>
            <span>Audio File</span>
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />

      {/* WhatsApp Style: Input Bar + Circular Action Button */}
      <div className="flex items-end space-x-2 w-full">
        {/* Rounded Input Pill */}
        <div className="flex-1 flex items-end space-x-1.5 sm:space-x-2 bg-surface-muted border border-border-default/80 focus-within:border-accent-500 focus-within:bg-surface-elevated rounded-2xl px-2.5 sm:px-3 py-1 transition-colors min-w-0 shadow-subtle">
          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-base transition-colors flex-shrink-0 mb-0.5"
            title="Add Emoji"
          >
            <Smile size={19} />
          </button>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder={isUploading ? 'Uploading file...' : 'Type a message...'}
            disabled={isUploading}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none py-1.5 max-h-32 min-h-[24px] leading-relaxed"
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            className="p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-base transition-colors flex-shrink-0 mb-0.5"
            title="Attach file"
          >
            <Paperclip size={19} />
          </button>
        </div>

        {/* Circular Action Button: Send or Voice Recorder */}
        <div className="flex-shrink-0 pb-0.5">
          {text.trim() ? (
            <button
              type="button"
              onClick={() => handleSend()}
              className="w-10 h-10 rounded-full bg-accent-500 hover:bg-accent-600 active:scale-95 text-white flex items-center justify-center transition-all shadow-subtle"
              title="Send Message"
            >
              <Send size={17} className="ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="w-10 h-10 rounded-full bg-accent-500/10 hover:bg-accent-500/20 active:scale-95 text-accent-600 dark:text-accent-400 flex items-center justify-center transition-all shadow-subtle"
              title="Record Voice Message"
            >
              <Mic size={19} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Message, User } from '../../../shared/types';
import { StatusTicks } from '../../../shared/components/StatusTicks';
import { formatMessageTime, formatFileSize, getMediaUrl, cn } from '../../../shared/lib/utils';
import { Play, Pause, FileText, Download, Reply, MoreVertical, Trash2, Smile, Copy } from 'lucide-react';
import { useChatStore } from '../../conversations/store/chatStore';
import { useUIStore } from '../../../shared/store/uiStore';
import api from '../../../shared/lib/axios';
import { getSocket } from '../../../socket/socketClient';

interface MessageBubbleProps {
  message: Message;
  currentUser: User | null;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUser }) => {
  const isSent = currentUser ? message.senderId === currentUser.id : false;
  const { setReplyTo } = useChatStore();
  const { setActiveMedia } = useUIStore();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const progress = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
    setAudioProgress(progress);
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
  };

  const handleToggleReaction = (emoji: string) => {
    setShowEmojiPicker(false);
    const socket = getSocket();
    if (socket) {
      socket.emit('reaction:toggle', {
        messageId: message.id,
        conversationId: message.conversationId,
        emoji,
      });
    }
  };

  const handleDelete = async (scope: 'me' | 'everyone') => {
    setShowMenu(false);
    try {
      await api.delete(`/messages/${message.id}?scope=${scope}`);
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const handleCopy = () => {
    setShowMenu(false);
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col mb-1.5 max-w-[85%] sm:max-w-[70%] select-text',
        isSent ? 'self-end items-end' : 'self-start items-start'
      )}
    >
      {/* Reply Quote Banner */}
      {message.replyTo && (
        <div
          className={cn(
            'flex flex-col px-3 py-1.5 mb-1 rounded-lg text-xs border-l-2 bg-black/5 dark:bg-white/5 truncate max-w-full',
            isSent ? 'border-l-accent-300' : 'border-l-accent-500'
          )}
        >
          <span className="font-semibold text-accent-600 dark:text-accent-400">
            {message.replyTo.senderId === currentUser?.id ? 'You' : 'Reply'}
          </span>
          <span className="truncate opacity-80">{message.replyTo.content || `[${message.replyTo.type}]`}</span>
        </div>
      )}

      {/* Main Bubble Container */}
      <div
        className={cn(
          'relative px-3.5 py-2 text-sm leading-relaxed shadow-subtle break-words',
          isSent
            ? 'bg-accent-500 text-white rounded-bubble-sent rounded-br-sm'
            : 'bg-surface-elevated text-text-primary rounded-bubble-recv rounded-bl-sm border border-border-subtle/70'
        )}
      >
        {/* Deleted Message Placeholder */}
        {message.deletedForEveryone ? (
          <span className="italic text-xs opacity-75">This message was deleted</span>
        ) : (
          <>
            {/* Image Media */}
            {message.type === 'image' && message.media?.url && (
              <div
                className="cursor-pointer overflow-hidden rounded-lg mb-1.5 max-w-sm"
                onClick={() => setActiveMedia(message.media!)}
              >
                <img
                  src={getMediaUrl(message.media.url)}
                  alt="Shared media"
                  className="w-full max-h-72 object-cover rounded-lg hover:opacity-95 transition-opacity"
                  loading="lazy"
                />
              </div>
            )}

            {/* Video Media */}
            {message.type === 'video' && message.media?.url && (
              <div className="overflow-hidden rounded-lg mb-1.5 max-w-sm">
                <video src={getMediaUrl(message.media.url)} controls className="w-full max-h-72 rounded-lg bg-black" />
              </div>
            )}

            {/* Audio / Voice Message */}
            {(message.type === 'voice' || message.type === 'audio') && message.media?.url && (
              <div className="flex items-center space-x-3 py-1 min-w-[200px]">
                <audio
                  ref={audioRef}
                  src={getMediaUrl(message.media.url)}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={handleAudioEnded}
                />
                <button
                  onClick={toggleAudio}
                  className={cn(
                    'p-2 rounded-full flex items-center justify-center transition-colors shadow-subtle',
                    isSent ? 'bg-white text-accent-600 hover:bg-white/90' : 'bg-accent-500 text-white hover:bg-accent-600'
                  )}
                  aria-label={isPlayingAudio ? 'Pause audio' : 'Play audio'}
                >
                  {isPlayingAudio ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>

                <div className="flex-1 flex flex-col justify-center space-y-1">
                  {/* Waveform / Progress bar */}
                  <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-100', isSent ? 'bg-white' : 'bg-accent-500')}
                      style={{ width: `${audioProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono opacity-80">
                    {message.media.duration ? `${Math.floor(message.media.duration)}s` : 'Voice Note'}
                  </span>
                </div>
              </div>
            )}

            {/* Document Media */}
            {message.type === 'document' && message.media?.url && (
              <a
                href={getMediaUrl(message.media.url)}
                target="_blank"
                rel="noreferrer"
                download={message.media.filename || 'document'}
                className={cn(
                  'flex items-center space-x-2.5 p-2 rounded-lg border mb-1.5 transition-colors',
                  isSent
                    ? 'bg-black/10 border-white/20 hover:bg-black/20 text-white'
                    : 'bg-surface-muted border-border-default hover:bg-surface-base text-text-primary'
                )}
              >
                <FileText size={20} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{message.media.filename || 'Document'}</p>
                  <p className="text-[10px] opacity-75">{formatFileSize(message.media.size || 0)}</p>
                </div>
                <Download size={14} className="flex-shrink-0 opacity-80" />
              </a>
            )}

            {/* Text Content */}
            {message.content && <p className="whitespace-pre-wrap select-text">{message.content}</p>}
          </>
        )}

        {/* Timestamp & Status Metadata */}
        <div
          className={cn(
            'flex items-center justify-end space-x-1 mt-1 text-[10px]',
            isSent ? 'text-white/80' : 'text-text-tertiary'
          )}
        >
          {message.editedAt && <span className="italic mr-0.5">edited</span>}
          <span>{formatMessageTime(message.sentAt)}</span>
          {isSent && (
            <StatusTicks
              status={message.status}
              isOptimistic={message.isOptimistic}
              hasError={message.hasError}
            />
          )}
        </div>
      </div>

      {/* Emoji Reactions Strip */}
      {message.reactions && message.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {message.reactions.map((r, i) => (
            <button
              key={i}
              onClick={() => handleToggleReaction(r.emoji)}
              className={cn(
                'flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-xs bg-surface-elevated border border-border-default shadow-subtle hover:scale-105 transition-transform',
                r.userId === currentUser?.id && 'border-accent-500 bg-accent-500/10'
              )}
            >
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hover Action Menu Trigger */}
      <div
        className={cn(
          'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 bg-surface-elevated border border-border-default rounded-full p-0.5 shadow-subtle z-20',
          isSent ? '-left-16' : '-right-16'
        )}
      >
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="React"
        >
          <Smile size={14} />
        </button>

        <button
          onClick={() =>
            setReplyTo({
              messageId: message.id,
              senderId: message.senderId,
              content: message.content || `[${message.type}]`,
              type: message.type,
            })
          }
          className="p-1 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="Reply"
        >
          <Reply size={14} />
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="More"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Quick Reaction Floating Picker */}
      {showEmojiPicker && (
        <div className="absolute top-8 z-30 flex items-center space-x-1 bg-surface-elevated border border-border-default rounded-full p-1.5 shadow-elevated animate-message-in">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(emoji)}
              className="p-1 text-base hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Context Menu Modal / Dropdown */}
      {showMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute top-8 z-30 bg-surface-elevated border border-border-default rounded-xl shadow-elevated py-1 w-40 text-xs text-text-primary flex flex-col',
            isSent ? 'right-0' : 'left-0'
          )}
        >
          {message.content && (
            <button
              onClick={handleCopy}
              className="flex items-center px-3 py-2 hover:bg-surface-muted transition-colors text-left"
            >
              <Copy size={13} className="mr-2 text-text-secondary" />
              Copy Text
            </button>
          )}

          <button
            onClick={() => handleDelete('me')}
            className="flex items-center px-3 py-2 hover:bg-surface-muted transition-colors text-left text-text-primary"
          >
            <Trash2 size={13} className="mr-2 text-text-secondary" />
            Delete for me
          </button>

          {isSent && !message.deletedForEveryone && (
            <button
              onClick={() => handleDelete('everyone')}
              className="flex items-center px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left font-medium"
            >
              <Trash2 size={13} className="mr-2" />
              Delete for everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
};

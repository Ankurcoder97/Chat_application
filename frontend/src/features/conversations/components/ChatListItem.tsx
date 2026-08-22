import React, { useState } from 'react';
import { Conversation } from '../../../shared/types';
import { Avatar } from '../../../shared/components/Avatar';
import { formatChatTimestamp, cn } from '../../../shared/lib/utils';
import { Pin, VolumeX, MoreVertical, Archive } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import api from '../../../shared/lib/axios';
import { useQueryClient } from '@tanstack/react-query';

interface ChatListItemProps {
  conversation: Conversation;
  isSelected?: boolean;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ conversation, isSelected = false }) => {
  const { setActiveConversation, typingUsers, onlineUsers } = useChatStore();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);

  const participant = conversation.participant;
  const name = participant?.name || 'Unknown User';
  const avatarUrl = participant?.avatarUrl;
  const isOnline = participant?.id ? onlineUsers.has(participant.id) || participant.isOnline : false;

  const isTyping = typingUsers[conversation.id];

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await api.patch(`/conversations/${conversation.id}`, { isPinned: !conversation.isPinned });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await api.patch(`/conversations/${conversation.id}`, { isMuted: !conversation.isMuted });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await api.patch(`/conversations/${conversation.id}`, { isArchived: !conversation.isArchived });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      onClick={() => setActiveConversation(conversation)}
      className={cn(
        'group relative flex items-center px-4 py-3.5 cursor-pointer transition-colors select-none border-b border-border-subtle/50',
        isSelected
          ? 'bg-accent-500/10 dark:bg-accent-500/15 border-l-4 border-l-accent-500'
          : 'hover:bg-surface-muted active:bg-surface-muted/80'
      )}
    >
      <Avatar name={name} avatarUrl={avatarUrl} size="md" isOnline={isOnline} showOnlineDot className="mr-3" />

      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className={cn('text-sm font-semibold truncate', isSelected ? 'text-accent-600 dark:text-accent-400' : 'text-text-primary')}>
              {name}
            </span>
            {conversation.isPinned && <Pin size={12} className="text-accent-500 fill-accent-500 flex-shrink-0" />}
            {conversation.isMuted && <VolumeX size={12} className="text-text-tertiary flex-shrink-0" />}
          </div>
          <span className="text-[11px] text-text-tertiary flex-shrink-0 font-medium ml-2">
            {formatChatTimestamp(conversation.lastMessageAt || conversation.lastMessage?.sentAt)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-text-secondary truncate pr-2">
            {isTyping ? (
              <span className="text-accent-500 font-medium animate-pulse">typing...</span>
            ) : conversation.lastMessage ? (
              <span>{conversation.lastMessage.content || `[${conversation.lastMessage.type}]`}</span>
            ) : (
              <span className="text-text-tertiary italic">No messages yet</span>
            )}
          </div>

          {conversation.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent-500 text-white text-[10px] font-bold flex items-center justify-center shadow-subtle flex-shrink-0">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Quick context dropdown button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-elevated ml-1 transition-opacity"
        aria-label="Conversation actions"
      >
        <MoreVertical size={16} />
      </button>

      {/* Context Menu */}
      {showMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-4 top-12 z-30 bg-surface-elevated border border-border-default rounded-xl shadow-elevated py-1 w-36 text-xs text-text-primary flex flex-col"
        >
          <button
            onClick={handleTogglePin}
            className="flex items-center px-3 py-2 hover:bg-surface-muted transition-colors text-left"
          >
            <Pin size={14} className="mr-2 text-text-secondary" />
            {conversation.isPinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button
            onClick={handleToggleMute}
            className="flex items-center px-3 py-2 hover:bg-surface-muted transition-colors text-left"
          >
            <VolumeX size={14} className="mr-2 text-text-secondary" />
            {conversation.isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={handleToggleArchive}
            className="flex items-center px-3 py-2 hover:bg-surface-muted transition-colors text-left"
          >
            <Archive size={14} className="mr-2 text-text-secondary" />
            {conversation.isArchived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      )}
    </div>
  );
};

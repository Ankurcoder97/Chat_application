import React from 'react';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import { useChatStore } from '../../conversations/store/chatStore';
import { useCallStore } from '../../calls/store/callStore';
import { formatLastSeen } from '../../../shared/lib/utils';

export const ChatHeader: React.FC = () => {
  const { activeConversation, setActiveConversation, typingUsers, onlineUsers } = useChatStore();
  const { startOutgoingCall } = useCallStore();

  if (!activeConversation || !activeConversation.participant) return null;

  const participant = activeConversation.participant;
  const isTyping = typingUsers[activeConversation.id];
  const isOnline = onlineUsers.has(participant.id) || participant.isOnline;

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-surface-elevated border-b border-border-subtle z-20 select-none shadow-subtle flex-shrink-0 w-full">
      {/* Left Contact Info */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 mr-2">
        {/* Mobile Back Button (always visible on mobile & tablet < md) */}
        <button
          onClick={() => setActiveConversation(null)}
          className="p-2 -ml-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted md:hidden transition-colors flex-shrink-0"
          aria-label="Back to conversations"
          title="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <Avatar
          name={participant.name}
          avatarUrl={participant.avatarUrl}
          size="md"
          isOnline={isOnline}
          showOnlineDot
          className="flex-shrink-0"
        />

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold text-text-primary truncate">
            {participant.name}
          </span>
          <span className="text-xs truncate">
            {isTyping ? (
              <span className="text-accent-500 font-medium animate-pulse">typing...</span>
            ) : isOnline ? (
              <span className="text-emerald-500 font-medium">Online</span>
            ) : (
              <span className="text-text-tertiary">{formatLastSeen(participant.lastSeen)}</span>
            )}
          </span>
        </div>
      </div>

      {/* Right Action Icons (Voice Call, Video Call, Menu) */}
      <div className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
        <button
          onClick={() => startOutgoingCall(participant, 'voice')}
          className="p-2 sm:p-2.5 text-text-secondary hover:text-emerald-500 rounded-full hover:bg-surface-muted active:bg-surface-muted transition-colors"
          title="Start voice call"
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>

        <button
          onClick={() => startOutgoingCall(participant, 'video')}
          className="p-2 sm:p-2.5 text-text-secondary hover:text-accent-500 rounded-full hover:bg-surface-muted active:bg-surface-muted transition-colors"
          title="Start video call"
          aria-label="Video call"
        >
          <Video size={18} />
        </button>

        <button
          className="p-2 sm:p-2.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="Conversation options"
          aria-label="More options"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  );
};

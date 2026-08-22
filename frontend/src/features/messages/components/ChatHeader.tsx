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
    <div className="flex items-center justify-between px-4 py-3 bg-surface-elevated border-b border-border-subtle z-10 select-none shadow-subtle">
      <div className="flex items-center space-x-3 min-w-0">
        {/* Mobile Back Button */}
        <button
          onClick={() => setActiveConversation(null)}
          className="p-1.5 -ml-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted md:hidden transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={20} />
        </button>

        <Avatar
          name={participant.name}
          avatarUrl={participant.avatarUrl}
          size="md"
          isOnline={isOnline}
          showOnlineDot
        />

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">{participant.name}</span>
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

      <div className="flex items-center space-x-1">
        <button
          onClick={() => startOutgoingCall(participant, 'voice')}
          className="p-2 text-text-secondary hover:text-emerald-500 rounded-full hover:bg-surface-muted transition-colors"
          title="Voice call"
          aria-label="Start voice call"
        >
          <Phone size={18} />
        </button>
        <button
          onClick={() => startOutgoingCall(participant, 'video')}
          className="p-2 text-text-secondary hover:text-accent-500 rounded-full hover:bg-surface-muted transition-colors"
          title="Video call"
          aria-label="Start video call"
        >
          <Video size={18} />
        </button>
        <button
          className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-muted transition-colors"
          title="Conversation options"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
};

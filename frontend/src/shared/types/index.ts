export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string | null;
  privacy?: {
    showLastSeen: boolean;
    showOnlineStatus: boolean;
  };
}

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallPeer {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

export interface CallData {
  callId: string;
  peer: CallPeer;
  callType: CallType;
  status: CallStatus;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice';

export interface MediaPayload {
  url: string;
  mimeType: string;
  size: number;
  filename?: string;
  duration?: number;
  thumbnailUrl?: string;
  waveformData?: number[];
}

export interface ReplyTo {
  messageId: string;
  senderId: string;
  content: string;
  type: MessageType;
}

export interface Reaction {
  emoji: string;
  userId: string;
  reactedAt: string;
}

export interface MessageStatus {
  delivered: Array<{ userId: string; at: string }>;
  read: Array<{ userId: string; at: string }>;
}

export interface Message {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  sender?: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  seqNo: number;
  type: MessageType;
  content: string;
  media?: MediaPayload | null;
  replyTo?: ReplyTo | null;
  reactions: Reaction[];
  forwardedFrom?: string;
  status: MessageStatus;
  editedAt?: string | null;
  deletedForEveryone?: boolean;
  sentAt: string;
  isOptimistic?: boolean;
  hasError?: boolean;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participant: User | null;
  lastMessage?: {
    id: string;
    content: string;
    type: string;
    sentAt: string;
    senderId?: string;
  } | null;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
}

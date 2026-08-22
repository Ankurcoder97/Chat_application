import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IParticipantMeta {
  userId: Types.ObjectId;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  mutedUntil?: Date;
  isArchived: boolean;
  lastReadMessageId?: Types.ObjectId;
  deletedAt?: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  type: 'direct' | 'group';
  participants: Types.ObjectId[];
  lastMessage?: {
    id: Types.ObjectId;
    content: string;
    type: string;
    sentAt: Date;
    senderId: Types.ObjectId;
  };
  lastMessageAt: Date;
  seqCounter: number;
  participantMeta: IParticipantMeta[];
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantMetaSchema = new Schema<IParticipantMeta>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    unreadCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date },
    isArchived: { type: Boolean, default: false },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    deletedAt: { type: Date },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
      id: { type: Schema.Types.ObjectId, ref: 'Message' },
      content: { type: String, default: '' },
      type: { type: String, default: 'text' },
      sentAt: { type: Date, default: Date.now },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    seqCounter: { type: Number, default: 0 },
    participantMeta: [ParticipantMetaSchema],
  },
  { timestamps: true }
);

// Indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

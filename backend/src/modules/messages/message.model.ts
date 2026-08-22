import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice';

export interface IMedia {
  url: string;
  mimeType: string;
  size: number;
  filename?: string;
  duration?: number;
  thumbnailUrl?: string;
  waveformData?: number[];
}

export interface IReplyTo {
  messageId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: MessageType;
}

export interface IReaction {
  emoji: string;
  userId: Types.ObjectId;
  reactedAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  clientId: string;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  seqNo: number;
  type: MessageType;
  content: string;
  media?: IMedia;
  replyTo?: IReplyTo;
  reactions: IReaction[];
  forwardedFrom?: Types.ObjectId;
  status: {
    delivered: Array<{ userId: Types.ObjectId; at: Date }>;
    read: Array<{ userId: Types.ObjectId; at: Date }>;
  };
  editedAt?: Date;
  editHistory?: Array<{ content: string; editedAt: Date }>;
  deletedFor: Types.ObjectId[];
  deletedForEveryone: boolean;
  deletedForEveryoneAt?: Date;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    filename: { type: String },
    duration: { type: Number },
    thumbnailUrl: { type: String },
    waveformData: [{ type: Number }],
  },
  { _id: false }
);

const ReplyToSchema = new Schema<IReplyTo>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: { type: String, default: 'text' },
  },
  { _id: false }
);

const ReactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    clientId: { type: String, required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seqNo: { type: Number, required: true, index: true },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'document', 'voice'],
      default: 'text',
    },
    content: { type: String, default: '', maxlength: 4000 },
    media: MediaSchema,
    replyTo: ReplyToSchema,
    reactions: [ReactionSchema],
    forwardedFrom: { type: Schema.Types.ObjectId, ref: 'Message' },
    status: {
      delivered: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
      read: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
    },
    editedAt: { type: Date },
    editHistory: [{ content: String, editedAt: Date }],
    deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedForEveryone: { type: Boolean, default: false },
    deletedForEveryoneAt: { type: Date },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound Indexes for fast cursor pagination & search
MessageSchema.index({ conversationId: 1, seqNo: -1 });
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ clientId: 1, conversationId: 1 }, { unique: true });
MessageSchema.index({ conversationId: 1, content: 'text' });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

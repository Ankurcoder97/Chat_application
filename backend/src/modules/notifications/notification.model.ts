import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  senderId?: Types.ObjectId;
  type: 'message' | 'mention' | 'system';
  referenceId?: Types.ObjectId;
  referenceType?: string;
  title: string;
  body: string;
  avatarUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['message', 'mention', 'system'], default: 'message' },
    referenceId: { type: Schema.Types.ObjectId },
    referenceType: { type: String },
    title: { type: String, required: true },
    body: { type: String, required: true },
    avatarUrl: { type: String },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

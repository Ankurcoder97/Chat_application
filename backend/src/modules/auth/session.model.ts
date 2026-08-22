import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  lastActive: Date;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);

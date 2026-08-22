import mongoose, { Schema, Document, Types } from 'mongoose';

export type CallStatusType = 'missed' | 'rejected' | 'completed' | 'cancelled';
export type CallMediaType = 'voice' | 'video';

export interface ICallLog extends Document {
  _id: Types.ObjectId;
  callId: string;
  callerId: Types.ObjectId;
  recipientId: Types.ObjectId;
  callType: CallMediaType;
  status: CallStatusType;
  duration: number; // in seconds
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CallLogSchema = new Schema<ICallLog>(
  {
    callId: { type: String, required: true, index: true },
    callerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    callType: { type: String, enum: ['voice', 'video'], required: true },
    status: {
      type: String,
      enum: ['missed', 'rejected', 'completed', 'cancelled'],
      default: 'missed',
    },
    duration: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index for chronological querying of user's call logs
CallLogSchema.index({ callerId: 1, createdAt: -1 });
CallLogSchema.index({ recipientId: 1, createdAt: -1 });

export const CallLog = mongoose.model<ICallLog>('CallLog', CallLogSchema);

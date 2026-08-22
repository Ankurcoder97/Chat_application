import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  username: string;
  passwordHash: string;
  avatarUrl?: string;
  bio?: string;
  isEmailVerified: boolean;
  lastSeen?: Date;
  isOnline?: boolean;
  privacy: {
    showLastSeen: boolean;
    showOnlineStatus: boolean;
  };
  blockedUsers: Types.ObjectId[];
  pushTokens: Array<{ token: string; platform: string; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 150 },
    isEmailVerified: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    privacy: {
      showLastSeen: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true },
    },
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pushTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: 'web' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Full-text search index for search discovery
UserSchema.index({ name: 'text', username: 'text', phone: 'text' });

export const User = mongoose.model<IUser>('User', UserSchema);

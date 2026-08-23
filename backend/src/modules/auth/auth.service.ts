import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { User, IUser } from '../users/user.model';
import { Session } from './session.model';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../shared/errors';
import { cacheSet, cacheDel } from '../../shared/redis';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
}

export class AuthService {
  private getRefreshExpiryDate(): Date {
    const match = config.JWT_REFRESH_EXPIRY.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRY as any,
    });
  }

  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRY as any,
    });
  }

  public verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  public verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  public async register(
    name: string,
    email: string,
    password: string,
    username?: string,
    avatarUrl?: string,
    phone?: string
  ) {
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        ...(username ? [{ username: username.toLowerCase() }] : []),
        ...(phone ? [{ phone: phone.trim() }] : []),
      ],
    });

    if (existing) {
      if (existing.email === email.toLowerCase()) {
        throw new ConflictError('An account with this email already exists');
      }
      if (phone && existing.phone === phone.trim()) {
        throw new ConflictError('An account with this phone number already exists');
      }
      throw new ConflictError('This username is already taken');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const generatedUsername =
      username ||
      email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + Math.floor(100 + Math.random() * 900);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      username: generatedUsername.toLowerCase(),
      passwordHash,
      avatarUrl: avatarUrl || '',
    });

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);
    const deviceId = uuidv4();

    // Store session
    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = this.getRefreshExpiryDate();

    await Session.create({
      userId: user._id,
      deviceId,
      refreshTokenHash: refreshHash,
      expiresAt,
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
      accessToken,
      refreshToken,
      deviceId,
    };
  }

  public async login(identifier: string, password: string, userAgent = '', ipAddress = '') {
    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanId }, { username: cleanId }, { phone: identifier.trim() }],
    }).select('+passwordHash');

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);
    const deviceId = uuidv4();

    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = this.getRefreshExpiryDate();

    await Session.create({
      userId: user._id,
      deviceId,
      refreshTokenHash: refreshHash,
      userAgent,
      ipAddress,
      expiresAt,
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
      accessToken,
      refreshToken,
      deviceId,
    };
  }

  public async refreshTokens(oldRefreshToken: string) {
    const payload = this.verifyRefreshToken(oldRefreshToken);
    const user = await User.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Find and rotate session
    const sessions = await Session.find({ userId: user._id });
    let matchedSession = null;

    for (const session of sessions) {
      const match = await bcrypt.compare(oldRefreshToken, session.refreshTokenHash);
      if (match) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      // Possible reuse attack - clear all sessions for safety
      await Session.deleteMany({ userId: user._id });
      throw new UnauthorizedError('Invalid session token');
    }

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(tokenPayload);

    // Rotate session token
    matchedSession.refreshTokenHash = await bcrypt.hash(newRefreshToken, 8);
    matchedSession.lastActive = new Date();
    matchedSession.expiresAt = this.getRefreshExpiryDate();
    await matchedSession.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async logout(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      const sessions = await Session.find({ userId: payload.userId });
      for (const session of sessions) {
        const match = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (match) {
          await Session.findByIdAndDelete(session._id);
          break;
        }
      }
    } catch {
      // Ignore token decoding error on logout
    }
  }
}

export const authService = new AuthService();

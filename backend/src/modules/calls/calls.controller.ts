import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../auth/auth.middleware';
import { CallLog } from './callLog.model';

export class CallsController {
  public async getCallHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = new Types.ObjectId(req.user?.userId);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

      const logs = await CallLog.find({
        $or: [{ callerId: currentUserId }, { recipientId: currentUserId }],
      })
        .sort({ startedAt: -1 })
        .limit(limit)
        .populate('callerId', 'name username avatarUrl phone')
        .populate('recipientId', 'name username avatarUrl phone')
        .lean();

      const formatted = logs.map((log) => {
        const isCaller = (log.callerId as any)._id?.toString() === currentUserId.toString();
        const peer = isCaller ? log.recipientId : log.callerId;

        // Determine direction relative to current user
        let direction: 'incoming' | 'outgoing' | 'missed' = isCaller ? 'outgoing' : 'incoming';
        if (!isCaller && (log.status === 'missed' || log.status === 'cancelled')) {
          direction = 'missed';
        }

        return {
          id: log._id,
          callId: log.callId,
          peer,
          isCaller,
          direction,
          callType: log.callType,
          status: log.status,
          duration: log.duration,
          startedAt: log.startedAt,
          endedAt: log.endedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const callsController = new CallsController();

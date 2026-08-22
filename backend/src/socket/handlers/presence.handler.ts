import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../socket.server';
import { cacheSet } from '../../shared/redis';

export function registerPresenceHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const currentUserId = socket.user?.userId;
  if (!currentUserId) return;

  // Client emits presence:heartbeat every 20-25 seconds
  socket.on('presence:heartbeat', async () => {
    try {
      // Refresh Redis presence key with 45s TTL
      await cacheSet(`user:online:${currentUserId}`, '1', 45);
    } catch {
      // Ignore heartbeat error
    }
  });
}

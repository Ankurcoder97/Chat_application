import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../socket.server';

export function registerTypingHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const currentUserId = socket.user?.userId;
  const currentUsername = socket.user?.username;
  if (!currentUserId) return;

  socket.on('typing:start', ({ conversationId, recipientId }) => {
    if (!recipientId || !conversationId) return;
    io.to(`user:${recipientId}`).emit('typing:start', {
      conversationId,
      userId: currentUserId,
      username: currentUsername,
    });
  });

  socket.on('typing:stop', ({ conversationId, recipientId }) => {
    if (!recipientId || !conversationId) return;
    io.to(`user:${recipientId}`).emit('typing:stop', {
      conversationId,
      userId: currentUserId,
      username: currentUsername,
    });
  });
}

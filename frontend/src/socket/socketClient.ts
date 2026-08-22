import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let heartbeatInterval: any = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  const token = localStorage.getItem('nexus_access_token');
  if (!token) {
    if (socket) socket.disconnect();
    return null as any;
  }

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  const targetUrl =
    import.meta.env.VITE_SOCKET_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:5000' : undefined);

  socket = io(targetUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    // Start presence heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('presence:heartbeat');
      }
    }, 20000);
  });

  socket.on('disconnect', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  return socket;
}

export function disconnectSocket() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

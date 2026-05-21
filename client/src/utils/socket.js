import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export const connectUserSocket = (user) => {
  if (!user?.id) return socket;
  if (!socket.connected) socket.connect();
  socket.emit('user_online', {
    id: user.id,
    role: user.role,
    department: user.department,
    name: user.full_name || user.name
  });
  return socket;
};

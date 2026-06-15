import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Middleware
const corsOptions = process.env.CLIENT_ORIGIN
  ? { origin: process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim()) }
  : {};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Basic route to test the server
app.get('/', (req, res) => {
  res.send('TSMS Backend API is running...');
});

// ==========================================
// Modular API Routes setup
// ==========================================
import authRoutes from './routes/authRoutes.js';

app.use('/api/auth', authRoutes);

import applicationRoutes from './routes/appRoutes.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import goalRoutes from './routes/goalRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';

app.use('/api/applications', applicationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', paymentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/meetings', meetingRoutes);
// ==========================================

app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ message: err.message || 'Invalid request' });
  }
  next();
});

const PORT = process.env.PORT || 5000;

const io = new Server(httpServer, {
  cors: corsOptions.origin ? corsOptions : { origin: '*' }
});

const onlineUsers = new Map();
app.set('onlineUsers', onlineUsers);

io.on('connection', (socket) => {
  socket.on('user_online', (user) => {
    if (!user?.id) return;
    const userId = String(user.id);
    onlineUsers.set(userId, socket.id);
    socket.data.userId = userId;
    io.emit('presence_update', { userId, online: true });
  });

  socket.on('typing', ({ senderId, receiverId, isTyping }) => {
    if (!receiverId) return;
    const targetSocketId = onlineUsers.get(String(receiverId));
    if (targetSocketId) {
      io.to(targetSocketId).emit('typing', {
        senderId,
        receiverId,
        isTyping: Boolean(isTyping)
      });
    }
  });

  socket.on('message_reaction', ({ senderId, receiverId, messageId, emoji }) => {
    if (!receiverId) return;
    const targetSocketId = onlineUsers.get(String(receiverId));
    if (targetSocketId) {
      io.to(targetSocketId).emit('message_reaction', { senderId, messageId, emoji });
    }
  });

  socket.on('disconnect', () => {
    if (!socket.data.userId) return;
    onlineUsers.delete(socket.data.userId);
    io.emit('presence_update', { userId: socket.data.userId, online: false });
  });
});

app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

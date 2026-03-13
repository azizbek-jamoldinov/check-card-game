import { Server as SocketIOServer } from 'socket.io';
import { registerRoomHandlers } from './roomHandlers';

export function registerSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Register room management handlers (F-016 to F-021)
    registerRoomHandlers(io, socket);
  });
}

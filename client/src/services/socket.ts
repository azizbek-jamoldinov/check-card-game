import { io, Socket } from 'socket.io-client';

// Use the same hostname the page was loaded from, so it works on LAN (e.g. phone).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export default socket;

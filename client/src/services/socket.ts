import { io, Socket } from 'socket.io-client';

// Use the same hostname the page was loaded from, so it works on LAN (e.g. phone).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// Keep socket alive when the browser tab is backgrounded / switched.
// On mobile, the OS may throttle or kill the WebSocket; when the user returns
// we check connectivity and force a reconnect if needed.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && socket.disconnected && socket.active) {
    socket.connect();
  }
});

export default socket;

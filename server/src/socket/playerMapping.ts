/**
 * Bidirectional mapping between socket IDs and player/room info.
 * Allows quick lookups in both directions for disconnect handling.
 */

interface PlayerMapping {
  playerId: string;
  roomCode: string;
  username: string;
}

/** socketId -> { playerId, roomCode, username } */
const socketToPlayer = new Map<string, PlayerMapping>();

/** playerId -> socketId */
const playerToSocket = new Map<string, string>();

export function registerPlayer(
  socketId: string,
  playerId: string,
  roomCode: string,
  username: string,
): void {
  socketToPlayer.set(socketId, { playerId, roomCode, username });
  playerToSocket.set(playerId, socketId);
}

export function unregisterPlayer(socketId: string): PlayerMapping | undefined {
  const mapping = socketToPlayer.get(socketId);
  if (mapping) {
    socketToPlayer.delete(socketId);
    playerToSocket.delete(mapping.playerId);
  }
  return mapping;
}

export function getPlayerBySocket(socketId: string): PlayerMapping | undefined {
  return socketToPlayer.get(socketId);
}

export function getSocketByPlayer(playerId: string): string | undefined {
  return playerToSocket.get(playerId);
}

export function isPlayerConnected(playerId: string): boolean {
  return playerToSocket.has(playerId);
}

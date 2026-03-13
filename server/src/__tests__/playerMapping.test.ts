import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPlayer,
  unregisterPlayer,
  getPlayerBySocket,
  getSocketByPlayer,
  isPlayerConnected,
} from '../socket/playerMapping';

// The module uses module-level Maps, so we need to clean up between tests.
// Since there's no exported clear function, we unregister all known sockets manually.

describe('playerMapping', () => {
  // Track registered socket IDs so we can clean up
  const registeredSockets: string[] = [];

  beforeEach(() => {
    // Clean up any previously registered mappings
    for (const socketId of registeredSockets) {
      unregisterPlayer(socketId);
    }
    registeredSockets.length = 0;
  });

  function register(socketId: string, playerId: string, roomCode: string, username: string) {
    registerPlayer(socketId, playerId, roomCode, username);
    registeredSockets.push(socketId);
  }

  describe('registerPlayer', () => {
    it('stores socket-to-player mapping', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');
      const mapping = getPlayerBySocket('socket-1');
      expect(mapping).toEqual({
        playerId: 'player-1',
        roomCode: 'ROOM01',
        username: 'Alice',
      });
    });

    it('stores player-to-socket mapping', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');
      expect(getSocketByPlayer('player-1')).toBe('socket-1');
    });

    it('handles multiple players', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');
      register('socket-2', 'player-2', 'ROOM01', 'Bob');

      expect(getPlayerBySocket('socket-1')?.playerId).toBe('player-1');
      expect(getPlayerBySocket('socket-2')?.playerId).toBe('player-2');
      expect(getSocketByPlayer('player-1')).toBe('socket-1');
      expect(getSocketByPlayer('player-2')).toBe('socket-2');
    });
  });

  describe('unregisterPlayer', () => {
    it('removes both mappings and returns the player info', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');

      const result = unregisterPlayer('socket-1');
      expect(result).toEqual({
        playerId: 'player-1',
        roomCode: 'ROOM01',
        username: 'Alice',
      });

      expect(getPlayerBySocket('socket-1')).toBeUndefined();
      expect(getSocketByPlayer('player-1')).toBeUndefined();
    });

    it('returns undefined for unknown socket ID', () => {
      expect(unregisterPlayer('unknown-socket')).toBeUndefined();
    });
  });

  describe('getPlayerBySocket', () => {
    it('returns undefined for unknown socket', () => {
      expect(getPlayerBySocket('nonexistent')).toBeUndefined();
    });
  });

  describe('getSocketByPlayer', () => {
    it('returns undefined for unknown player', () => {
      expect(getSocketByPlayer('nonexistent')).toBeUndefined();
    });
  });

  describe('isPlayerConnected', () => {
    it('returns true for registered player', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');
      expect(isPlayerConnected('player-1')).toBe(true);
    });

    it('returns false for unregistered player', () => {
      expect(isPlayerConnected('unknown')).toBe(false);
    });

    it('returns false after player is unregistered', () => {
      register('socket-1', 'player-1', 'ROOM01', 'Alice');
      unregisterPlayer('socket-1');
      expect(isPlayerConnected('player-1')).toBe(false);
    });
  });
});

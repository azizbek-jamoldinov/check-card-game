import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerGameHandlers } from '../socket/gameHandlers';
import type { GameState } from '../types/game.types';
import { initializeGameState } from '../game/GameSetup';

// ============================================================
// Mock RoomModel
// ============================================================

interface MockRoom {
  roomCode: string;
  host: string;
  players: { id: string; username: string }[];
  status: string;
  gameState: GameState | null;
  save: () => Promise<void>;
  markModified: (path: string) => void;
}

let rooms: Record<string, MockRoom> = {};

vi.mock('../models/Room', () => {
  return {
    RoomModel: {
      findOne: async ({ roomCode }: { roomCode: string }) => {
        return rooms[roomCode] ?? null;
      },
    },
  };
});

// ============================================================
// Mock playerMapping
// ============================================================

const playerSocketMap: Record<string, string> = {};

vi.mock('../socket/playerMapping', () => ({
  getSocketByPlayer: (playerId: string) => playerSocketMap[playerId] ?? null,
}));

// ============================================================
// Mock roomLock (no-op mutex)
// ============================================================

vi.mock('../utils/roomLock', () => ({
  getRoomMutex: () => ({
    acquire: async () => () => {},
  }),
}));

// ============================================================
// Mock Socket & IO
// ============================================================

function createMockSocket(id = 'socket-1') {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    id,
    join: vi.fn(),
    leave: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    emit: vi.fn(),
    _handlers: handlers,
  };
}

function createMockIO() {
  const emittedEvents: { socketId: string; event: string; data: unknown }[] = [];
  return {
    to: vi.fn((socketId: string) => ({
      emit: vi.fn((event: string, data: unknown) => {
        emittedEvents.push({ socketId, event, data });
      }),
    })),
    _emittedEvents: emittedEvents,
  };
}

// ============================================================
// Helper to create a room in roundEnd phase
// ============================================================

function createRoundEndRoom(
  roomCode: string,
  hostId: string,
  players: { id: string; username: string }[],
): MockRoom {
  const gameState = initializeGameState(players);
  // Set phase to roundEnd to simulate a round that just ended
  gameState.phase = 'roundEnd';
  gameState.checkCalledBy = players[0].id;
  gameState.checkCalledAtIndex = 0;

  const room: MockRoom = {
    roomCode,
    host: hostId,
    players,
    status: 'playing',
    gameState,
    save: vi.fn(async () => {
      rooms[roomCode] = room;
    }),
    markModified: vi.fn(),
  };

  rooms[roomCode] = room;
  return room;
}

// ============================================================
// Tests
// ============================================================

describe('gameHandlers — startNextRound', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let mockIO: ReturnType<typeof createMockIO>;

  const hostId = 'host-1';
  const player2Id = 'player-2';
  const players = [
    { id: hostId, username: 'Alice' },
    { id: player2Id, username: 'Bob' },
  ];

  beforeEach(() => {
    rooms = {};
    // Clear playerSocketMap
    Object.keys(playerSocketMap).forEach((k) => delete playerSocketMap[k]);
    playerSocketMap[hostId] = 'socket-host';
    playerSocketMap[player2Id] = 'socket-player2';

    mockSocket = createMockSocket('socket-host');
    mockIO = createMockIO();

    registerGameHandlers(mockIO as never, mockSocket as never);
  });

  function emitEvent(event: string, ...args: unknown[]) {
    const handler = mockSocket._handlers[event];
    if (!handler) throw new Error(`No handler registered for event: ${event}`);
    return handler(...args);
  }

  it('registers the startNextRound handler', () => {
    expect(mockSocket._handlers['startNextRound']).toBeDefined();
  });

  it('starts a new round when host requests it', async () => {
    const room = createRoundEndRoom('ABCD', hostId, players);
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: hostId }, callback);

    expect(callback).toHaveBeenCalledWith({ success: true });
    expect(room.save).toHaveBeenCalled();

    // Game state should be updated with a new round
    const newState = room.gameState as GameState;
    expect(newState.roundNumber).toBe(2);
    expect(newState.phase).toBe('peeking');
  });

  it('rejects non-host player', async () => {
    createRoundEndRoom('ABCD', hostId, players);
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: player2Id }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Only the host can start the next round',
    });
  });

  it('rejects if room not found', async () => {
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ZZZZ', playerId: hostId }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room or game not found',
    });
  });

  it('rejects if room status is not playing', async () => {
    const room = createRoundEndRoom('ABCD', hostId, players);
    room.status = 'finished';
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: hostId }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Game is not in progress',
    });
  });

  it('rejects if game phase is not roundEnd', async () => {
    const room = createRoundEndRoom('ABCD', hostId, players);
    (room.gameState as GameState).phase = 'playing';
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: hostId }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Round has not ended yet',
    });
  });

  it('emits gameStarted to all players with personalized state', async () => {
    createRoundEndRoom('ABCD', hostId, players);
    const callback = vi.fn();

    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: hostId }, callback);

    // Should have emitted gameStarted to both players
    const gameStartedEvents = mockIO._emittedEvents.filter((e) => e.event === 'gameStarted');
    expect(gameStartedEvents).toHaveLength(2);

    const hostEvent = gameStartedEvents.find((e) => e.socketId === 'socket-host');
    const player2Event = gameStartedEvents.find((e) => e.socketId === 'socket-player2');
    expect(hostEvent).toBeDefined();
    expect(player2Event).toBeDefined();

    // Each should have gameState and peekedCards
    const hostPayload = hostEvent!.data as { gameState: unknown; peekedCards: unknown[] };
    expect(hostPayload.gameState).toBeDefined();
    expect(hostPayload.peekedCards).toBeDefined();
    expect(hostPayload.peekedCards).toHaveLength(2); // Peek slots C and D
  });

  it('preserves existing scores into the new round', async () => {
    const room = createRoundEndRoom('ABCD', hostId, players);
    // Set some existing scores
    (room.gameState as GameState).scores = { [hostId]: 15, [player2Id]: 22 };

    const callback = vi.fn();
    await emitEvent('startNextRound', { roomCode: 'ABCD', playerId: hostId }, callback);

    expect(callback).toHaveBeenCalledWith({ success: true });

    const newState = room.gameState as GameState;
    expect(newState.scores[hostId]).toBe(15);
    expect(newState.scores[player2Id]).toBe(22);
  });
});

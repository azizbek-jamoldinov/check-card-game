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

// ============================================================
// redJackSwap — swap notification fields
// ============================================================

describe('gameHandlers — redJackSwap swap notification', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let mockIO: ReturnType<typeof createMockIO>;

  const p1Id = 'player-1';
  const p2Id = 'player-2';
  const playersList = [
    { id: p1Id, username: 'Alice' },
    { id: p2Id, username: 'Bob' },
  ];

  beforeEach(() => {
    rooms = {};
    Object.keys(playerSocketMap).forEach((k) => delete playerSocketMap[k]);
    playerSocketMap[p1Id] = 'socket-p1';
    playerSocketMap[p2Id] = 'socket-p2';

    mockSocket = createMockSocket('socket-p1');
    mockIO = createMockIO();

    registerGameHandlers(mockIO as never, mockSocket as never);
  });

  function emitEvent(event: string, ...args: unknown[]) {
    const handler = mockSocket._handlers[event];
    if (!handler) throw new Error(`No handler registered for event: ${event}`);
    return handler(...args);
  }

  function createRedJackRoom(): MockRoom {
    const gameState = initializeGameState(playersList);
    gameState.phase = 'playing';
    gameState.currentTurnIndex = 0;
    // Set a pending Red Jack effect for player 1
    gameState.pendingEffect = {
      type: 'redJack',
      playerId: p1Id,
      card: { id: 'jh', suit: '♥', rank: 'J', value: -1, isRed: true },
    };

    const room: MockRoom = {
      roomCode: 'RJCK',
      host: p1Id,
      players: playersList,
      status: 'playing',
      gameState,
      save: vi.fn(async () => {
        rooms['RJCK'] = room;
      }),
      markModified: vi.fn(),
    };

    rooms['RJCK'] = room;
    return room;
  }

  it('includes swap details in specialEffectResolved when swap is performed', async () => {
    createRedJackRoom();
    const callback = vi.fn();

    await emitEvent(
      'redJackSwap',
      {
        roomCode: 'RJCK',
        playerId: p1Id,
        mySlot: 'A',
        targetPlayerId: p2Id,
        targetSlot: 'B',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });

    // Find specialEffectResolved events
    const effectEvents = mockIO._emittedEvents.filter((e) => e.event === 'specialEffectResolved');
    // Should be emitted to both players
    expect(effectEvents.length).toBeGreaterThanOrEqual(2);

    // Check payload includes swap details
    for (const evt of effectEvents) {
      const payload = evt.data as Record<string, unknown>;
      expect(payload.effect).toBe('redJack');
      expect(payload.playerId).toBe(p1Id);
      expect(payload.skipped).toBe(false);
      expect(payload.swapperSlot).toBe('A');
      expect(payload.swapperUsername).toBe('Alice');
      expect(payload.targetPlayerId).toBe(p2Id);
      expect(payload.targetSlot).toBe('B');
      expect(payload.targetUsername).toBe('Bob');
    }
  });

  it('does NOT include swap details when skip is true', async () => {
    createRedJackRoom();
    const callback = vi.fn();

    await emitEvent(
      'redJackSwap',
      {
        roomCode: 'RJCK',
        playerId: p1Id,
        skip: true,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });

    const effectEvents = mockIO._emittedEvents.filter((e) => e.event === 'specialEffectResolved');
    expect(effectEvents.length).toBeGreaterThanOrEqual(2);

    for (const evt of effectEvents) {
      const payload = evt.data as Record<string, unknown>;
      expect(payload.effect).toBe('redJack');
      expect(payload.playerId).toBe(p1Id);
      expect(payload.skipped).toBe(true);
      // Swap details should NOT be present
      expect(payload.swapperSlot).toBeUndefined();
      expect(payload.swapperUsername).toBeUndefined();
      expect(payload.targetPlayerId).toBeUndefined();
      expect(payload.targetSlot).toBeUndefined();
      expect(payload.targetUsername).toBeUndefined();
    }
  });

  it('returns error when no pending Red Jack effect', async () => {
    const room = createRedJackRoom();
    (room.gameState as GameState).pendingEffect = null;
    const callback = vi.fn();

    await emitEvent(
      'redJackSwap',
      {
        roomCode: 'RJCK',
        playerId: p1Id,
        mySlot: 'A',
        targetPlayerId: p2Id,
        targetSlot: 'B',
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'No pending Red Jack effect for this player',
    });
  });

  it('returns error when required fields are missing for non-skip swap', async () => {
    createRedJackRoom();
    const callback = vi.fn();

    await emitEvent(
      'redJackSwap',
      {
        roomCode: 'RJCK',
        playerId: p1Id,
        // Missing mySlot, targetPlayerId, targetSlot
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'mySlot, targetPlayerId, and targetSlot are required',
    });
  });

  it('returns error when room not found', async () => {
    const callback = vi.fn();

    await emitEvent(
      'redJackSwap',
      {
        roomCode: 'ZZZZ',
        playerId: p1Id,
        skip: true,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error: 'Room or game not found',
    });
  });
});

// ============================================================
// Empty-hand burn — round ends immediately
// ============================================================

describe('gameHandlers — empty-hand burn ends round', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let mockIO: ReturnType<typeof createMockIO>;

  const p1Id = 'player-1';
  const p2Id = 'player-2';
  const playersList = [
    { id: p1Id, username: 'Alice' },
    { id: p2Id, username: 'Bob' },
  ];

  beforeEach(() => {
    rooms = {};
    Object.keys(playerSocketMap).forEach((k) => delete playerSocketMap[k]);
    playerSocketMap[p1Id] = 'socket-p1';
    playerSocketMap[p2Id] = 'socket-p2';

    mockSocket = createMockSocket('socket-p1');
    mockIO = createMockIO();

    registerGameHandlers(mockIO as never, mockSocket as never);
  });

  function emitEvent(event: string, ...args: unknown[]) {
    const handler = mockSocket._handlers[event];
    if (!handler) throw new Error(`No handler registered for event: ${event}`);
    return handler(...args);
  }

  /**
   * Creates a room where player 1 has exactly 1 card left, and the
   * discard pile top card has the same rank — guaranteeing a successful burn.
   */
  function createOneCardRoom(): MockRoom {
    const gameState = initializeGameState(playersList);
    gameState.phase = 'playing';
    gameState.currentTurnIndex = 0; // p1's turn

    // Give player 1 exactly one card whose rank matches the discard top
    const burnCard = { id: 'c1', suit: '♥' as const, rank: '7' as const, value: 7, isRed: true };
    gameState.players[0].hand = [{ slot: 'A', card: burnCard }];

    // Discard pile top has matching rank
    const discardCard = {
      id: 'c2',
      suit: '♠' as const,
      rank: '7' as const,
      value: 7,
      isRed: false,
    };
    gameState.discardPile = [discardCard];

    // Player 2 keeps their default 4-card hand

    const room: MockRoom = {
      roomCode: 'BURN',
      host: p1Id,
      players: playersList,
      status: 'playing',
      gameState,
      save: vi.fn(async () => {
        rooms['BURN'] = room;
      }),
      markModified: vi.fn(),
    };

    rooms['BURN'] = room;
    return room;
  }

  it('emits roundEnded with checkCalledBy=null when last card is burned', async () => {
    createOneCardRoom();
    const callback = vi.fn();

    await emitEvent(
      'playerAction',
      {
        roomCode: 'BURN',
        playerId: p1Id,
        action: { type: 'burn', slot: 'A' },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });

    // roundEnded should have been emitted to both players
    const roundEndedEvents = mockIO._emittedEvents.filter((e) => e.event === 'roundEnded');
    expect(roundEndedEvents).toHaveLength(2);

    // checkCalledBy should be null (empty-hand end, not check-based)
    for (const evt of roundEndedEvents) {
      const payload = evt.data as Record<string, unknown>;
      expect(payload.checkCalledBy).toBeNull();
    }
  });

  it('does NOT emit yourTurn after empty-hand round end', async () => {
    createOneCardRoom();
    const callback = vi.fn();

    await emitEvent(
      'playerAction',
      {
        roomCode: 'BURN',
        playerId: p1Id,
        action: { type: 'burn', slot: 'A' },
      },
      callback,
    );

    // yourTurn should NOT be emitted when the round has ended
    const yourTurnEvents = mockIO._emittedEvents.filter((e) => e.event === 'yourTurn');
    expect(yourTurnEvents).toHaveLength(0);
  });

  it('does NOT end round when burn succeeds but player still has cards', async () => {
    const room = createOneCardRoom();
    const gs = room.gameState as GameState;
    // Give player 1 two cards instead of one
    gs.players[0].hand = [
      {
        slot: 'A',
        card: { id: 'c1', suit: '♥' as const, rank: '7' as const, value: 7, isRed: true },
      },
      {
        slot: 'B',
        card: { id: 'c3', suit: '♦' as const, rank: 'K' as const, value: 13, isRed: true },
      },
    ];

    const callback = vi.fn();
    await emitEvent(
      'playerAction',
      {
        roomCode: 'BURN',
        playerId: p1Id,
        action: { type: 'burn', slot: 'A' },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });

    // roundEnded should NOT have been emitted
    const roundEndedEvents = mockIO._emittedEvents.filter((e) => e.event === 'roundEnded');
    expect(roundEndedEvents).toHaveLength(0);

    // yourTurn SHOULD be emitted (game continues)
    const yourTurnEvents = mockIO._emittedEvents.filter((e) => e.event === 'yourTurn');
    expect(yourTurnEvents).toHaveLength(1);
  });

  it('does NOT end round when burn fails (rank mismatch)', async () => {
    const room = createOneCardRoom();
    const gs = room.gameState as GameState;
    // Change the card rank so it doesn't match the discard
    gs.players[0].hand = [
      {
        slot: 'A',
        card: { id: 'c1', suit: '♥' as const, rank: '3' as const, value: 3, isRed: true },
      },
    ];

    const callback = vi.fn();
    await emitEvent(
      'playerAction',
      {
        roomCode: 'BURN',
        playerId: p1Id,
        action: { type: 'burn', slot: 'A' },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({ success: true });

    // roundEnded should NOT have been emitted (burn failed, penalty card added)
    const roundEndedEvents = mockIO._emittedEvents.filter((e) => e.event === 'roundEnded');
    expect(roundEndedEvents).toHaveLength(0);
  });
});

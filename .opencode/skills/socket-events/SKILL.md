---
name: socket-events
description: Socket.io event conventions, payload structures, validation patterns, error handling, and broadcasting rules for the Check Card Game
---

## Overview

The Check Card Game uses Socket.io for real-time multiplayer communication. The server is the single source of truth for all game state. Clients send action requests, the server validates and processes them, then broadcasts state updates.

---

## Architecture Principles

1. **Server-authoritative**: All game logic runs server-side. The client sends intents, not state mutations.
2. **Private data**: Never broadcast a player's hidden cards to other players. Each player receives a personalized view of the game state.
3. **Validation first**: Every incoming event must be validated before processing (correct room, correct player, correct turn, valid action).
4. **Acknowledge with callback**: Use Socket.io acknowledgement callbacks for request-response patterns (room creation, joining).
5. **Broadcast for state changes**: Use `io.to(roomCode)` for public updates, `socket.emit()` for private data.

---

## Connection Lifecycle

```typescript
// Client connects
io.on('connection', (socket) => {
  // Assign a temporary guest ID if not provided
  // Store socket.id <-> playerId mapping
  // Handle all events below
  
  socket.on('disconnect', () => {
    // Mark player as disconnected in their room
    // Notify other players
    // Start disconnect timeout (Phase 2)
  });
});
```

---

## Room Management Events

### `createRoom` (Client -> Server)

**When**: Player clicks "Create Room" on home page.

```typescript
// Client sends:
{
  username: string  // 1-20 characters, trimmed
}

// Server responds (callback):
{
  success: true,
  roomCode: string,   // 6-character uppercase alphanumeric
  playerId: string    // UUID for this player
}
// OR
{
  success: false,
  error: string
}

// Server also: socket.join(roomCode)
// Server broadcasts to room: 'roomUpdated'
```

**Validation**:
- Username must be 1-20 chars, non-empty after trim
- Generate unique 6-char room code

---

### `joinRoom` (Client -> Server)

**When**: Player enters room code and clicks "Join Room".

```typescript
// Client sends:
{
  roomCode: string,   // 6-char code
  username: string    // 1-20 characters
}

// Server responds (callback):
{
  success: true,
  playerId: string,
  room: RoomState      // Current room info
}
// OR
{
  success: false,
  error: string        // "Room not found", "Room is full", "Game already started"
}

// Server also: socket.join(roomCode)
// Server broadcasts to room: 'roomUpdated'
```

**Validation**:
- Room must exist
- Room status must be 'lobby'
- Player count must be < 6
- Username must be 1-20 chars, non-empty

---

### `leaveRoom` (Client -> Server)

**When**: Player clicks "Leave Room" or disconnects.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string
}

// Server: socket.leave(roomCode)
// Server broadcasts to room: 'roomUpdated'
// If host leaves: assign new host (next player)
// If game in progress: handle gracefully (Phase 2)
```

---

### `roomUpdated` (Server -> All Clients in Room)

**When**: Any room membership change (join, leave, host change).

```typescript
// Server broadcasts:
{
  roomCode: string,
  host: string,        // playerId of host
  players: {
    id: string,
    username: string,
    connected: boolean
  }[],
  status: 'lobby' | 'playing' | 'finished',
  maxPlayers: 6,
  minPlayers: 4
}
```

---

## Game Lifecycle Events

### `startGame` (Client -> Server)

**When**: Host clicks "Start Game" in lobby.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string
}

// Server responds (callback):
{
  success: true
}
// OR
{
  success: false,
  error: string    // "Not host", "Need 4+ players"
}
```

**Validation**:
- Sender must be room host
- Room must have 4-6 players
- Room status must be 'lobby'

**Server then**:
1. Initialize deck, shuffle, deal 4 cards per player
2. Select random starting player
3. Select 2 random peek slots per player
4. Set room status to 'playing'
5. Emit `gameStarted` to each player individually (private data)

---

### `gameStarted` (Server -> Each Client individually)

**When**: Host starts the game. Sent individually so each player gets their own card data.

```typescript
// Server sends to EACH player individually:
{
  yourPlayerId: string,
  yourCards: Card[],            // The 4 cards in this player's hand
  peekSlots: [string, string],  // Which 2 slots to reveal (e.g., ['A', 'C'])
  players: {
    id: string,
    username: string,
    cardCount: number,          // Always 4 at start
    slots: string[]             // ['A', 'B', 'C', 'D']
  }[],
  currentTurnPlayerId: string,
  roundNumber: number,
  scores: { [playerId: string]: number },
  discardPile: Card[],          // Initially empty or first card
  deckCount: number             // Cards remaining in deck
}
```

---

### `yourTurn` (Server -> Single Client)

**When**: It becomes a player's turn.

```typescript
// Server sends to current player only:
{
  playerId: string,
  canCheck: boolean,       // true if no one has called check yet
  availableActions: ('drawDeck' | 'takeDiscard' | 'burn')[]
}

// Server broadcasts to ALL:
{
  event: 'turnChanged',
  currentTurnPlayerId: string
}
```

---

## Game Action Events

### `callCheck` (Client -> Server)

**When**: Player calls check at the start of their turn, before any action.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string
}

// Server responds (callback):
{
  success: true
}

// Server broadcasts to room:
{
  event: 'checkCalled',
  playerId: string,
  username: string
}
```

**Validation**:
- Must be this player's turn
- No one else has already called check
- Must be called BEFORE taking an action
- Player's turn is then skipped (advance to next player)

---

### `playerAction` (Client -> Server)

**When**: Player performs one of the 3 turn actions.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  action: {
    type: 'drawDeck',
    // No additional params needed - card is drawn server-side
  } | {
    type: 'takeDiscard',
    // No additional params - top discard is taken
  } | {
    type: 'burn',
    slot: string           // Which slot to attempt burning (e.g., 'B')
  }
}

// Server responds (callback):
{
  success: true,
  data?: any              // Action-specific response data (see below)
}
// OR
{
  success: false,
  error: string
}
```

**Validation for all actions**:
- Must be this player's turn
- Player must not have already taken an action this turn
- Room must be in 'playing' status

---

### `cardDrawn` (Server -> Single Client)

**When**: Player draws from deck (Action 1). Only sent to the drawing player.

```typescript
// Server sends to drawing player ONLY:
{
  card: Card,              // The drawn card with full details
  // Player must now choose what to discard
}
```

**After receiving this, client must emit `discardChoice`.**

---

### `discardChoice` (Client -> Server)

**When**: After drawing from deck, player decides what to discard.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  choice: {
    discardDrawn: true     // Discard the drawn card, keep hand unchanged
  } | {
    discardDrawn: false,
    replaceSlot: string    // Slot to replace (e.g., 'B'). Hand card goes to discard.
  }
}
```

**Server then**:
1. Process the discard
2. Check if discarded card is a red face card that was just drawn
3. If yes -> emit `waitingForSpecialEffect`
4. If no -> broadcast `gameStateUpdated` and advance turn

---

### `discardFromTake` (Client -> Server)

**When**: After taking from discard pile, player decides which hand card to discard.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  discardSlot: string     // Which hand slot to discard (e.g., 'C')
}
```

---

### `burnResult` (Server -> All Clients)

**When**: After a burn attempt (Action 3).

```typescript
// Server broadcasts to room:
{
  playerId: string,
  slot: string,            // Which slot was attempted
  success: boolean,
  card: Card,              // The card that was burned (revealed on success)
  newCardCount: number,    // Player's updated hand size
  // If failed: penalty card added (player does NOT see it)
}

// If failed, server sends privately to burning player:
{
  event: 'penaltyReceived',
  newSlot: string          // The new slot label (e.g., 'E')
  // Card is NOT revealed - player doesn't see penalty card
}
```

---

## Special Effect Events

### `waitingForSpecialEffect` (Server -> Single Client)

**When**: Player discarded a red J/Q/K that was just drawn from deck.

```typescript
// Server sends to the player ONLY:
{
  effect: 'redJack' | 'redQueen' | 'redKing',
  card: Card,
  // For redKing, also include:
  drawnCards?: [Card, Card]  // The 2 extra cards drawn
}

// Server broadcasts to ALL others:
{
  event: 'playerUsingSpecialEffect',
  playerId: string,
  effect: 'redJack' | 'redQueen' | 'redKing'
}
```

---

### `redJackSwap` (Client -> Server)

**When**: Player decides on Jack swap action.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  skip: true               // Player chooses not to swap
} | {
  roomCode: string,
  playerId: string,
  skip: false,
  mySlot: string,          // Player's slot to swap (e.g., 'A')
  targetPlayerId: string,  // Opponent to swap with
  targetSlot: string       // Opponent's slot (e.g., 'C')
}

// Server broadcasts to room (no card details revealed):
{
  event: 'jackSwapPerformed',
  playerId: string,
  targetPlayerId: string,
  skipped: boolean
  // Do NOT reveal which slots or what cards were swapped
}
```

**Validation**:
- Target must be a different player in the same room
- Both slots must exist in respective hands
- mySlot must belong to the acting player
- targetSlot must belong to the target player

---

### `redQueenPeek` (Client -> Server)

**When**: Player chooses which card to peek at.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  slot: string             // Which of their own slots to peek (e.g., 'D')
}

// Server responds privately to player ONLY:
{
  slot: string,
  card: Card               // The revealed card
}

// Server broadcasts to room:
{
  event: 'queenPeekPerformed',
  playerId: string
  // Do NOT reveal which slot was peeked
}
```

**Validation**:
- Slot must exist in player's hand

---

### `redKingChoice` (Client -> Server)

**When**: Player decides what to do with the 2 drawn King cards.

```typescript
// Client sends:
{
  roomCode: string,
  playerId: string,
  choice: {
    type: 'returnBoth'
    // Both drawn cards returned to deck (shuffled in)
  } | {
    type: 'keepOne',
    keepIndex: 0 | 1,            // Which of the 2 drawn cards to keep
    replaceSlot: string          // Hand slot to replace (card goes to discard)
  } | {
    type: 'keepBoth',
    replaceSlots: [string, string]  // 2 hand slots to replace (both go to discard)
  }
}

// Server broadcasts to room:
{
  event: 'kingEffectPerformed',
  playerId: string,
  cardsKept: number,           // 0, 1, or 2
  discardedCards: Card[]       // Cards that went to discard pile (from hand)
  // Do NOT reveal what was kept or returned to deck
}
```

**Validation**:
- keepIndex must be 0 or 1
- replaceSlots must exist in player's hand
- replaceSlots must be distinct

---

## State Update Events

### `gameStateUpdated` (Server -> Each Client individually)

**When**: After any action is processed. Sent individually to personalize hidden data.

```typescript
// Server sends to EACH player individually:
{
  currentTurnPlayerId: string,
  roundNumber: number,
  checkCalledBy: string | null,
  deckCount: number,
  discardPile: Card[],          // All cards visible
  players: {
    id: string,
    username: string,
    cardCount: number,
    slots: string[],            // Slot labels only
    isCurrentTurn: boolean
  }[],
  yourHand: {                   // Only for this specific player
    slot: string,
    card: Card | null           // null = face down (player doesn't know)
  }[],
  scores: { [playerId: string]: number }
}
```

**Important**: The `yourHand` field should only include actual card data for cards the player has legitimately seen (peeked, drawn, taken from discard). Face-down unknown cards should be sent as `null`.

---

### `roundEnded` (Server -> All Clients)

**When**: Check caller's turn comes back around.

```typescript
// Server broadcasts to room:
{
  roundNumber: number,
  checkCalledBy: string,
  allHands: {
    playerId: string,
    username: string,
    cards: Card[],             // All cards revealed
    slots: string[],
    handSum: number
  }[],
  roundWinner: string,         // playerId with lowest sum
  updatedScores: { [playerId: string]: number },
  gameEnded: boolean,
  nextRoundStarting: boolean
}
```

---

### `gameEnded` (Server -> All Clients)

**When**: A player's total score reaches 100+.

```typescript
// Server broadcasts to room:
{
  finalScores: { [playerId: string]: number },
  winner: {                    // Lowest total score
    playerId: string,
    username: string,
    score: number
  },
  loser: {                     // Hit 100+ points
    playerId: string,
    username: string,
    score: number
  },
  allHands: {                  // Final round hands
    playerId: string,
    username: string,
    cards: Card[],
    handSum: number
  }[]
}
```

---

## Error Event

### `error` (Server -> Single Client)

**When**: Any validation failure or server error.

```typescript
// Server sends to the requesting client:
{
  code: string,       // Machine-readable error code
  message: string     // Human-readable error message
}
```

### Standard Error Codes

| Code | Message |
|------|---------|
| `ROOM_NOT_FOUND` | Room does not exist |
| `ROOM_FULL` | Room already has 6 players |
| `GAME_IN_PROGRESS` | Cannot join, game already started |
| `NOT_HOST` | Only the host can start the game |
| `NOT_ENOUGH_PLAYERS` | Need at least 4 players to start |
| `NOT_YOUR_TURN` | It is not your turn |
| `INVALID_ACTION` | Action type is not valid |
| `INVALID_SLOT` | Slot does not exist in your hand |
| `CHECK_ALREADY_CALLED` | Someone already called check |
| `INVALID_BURN` | Cannot burn - ranks do not match |
| `INVALID_SWAP_TARGET` | Cannot swap with yourself |
| `INVALID_USERNAME` | Username must be 1-20 characters |

---

## Event Flow Patterns

### Pattern: Request -> Validate -> Process -> Broadcast

Every client action follows this pattern:

```
1. Client emits event with payload
2. Server validates:
   a. Room exists and is in correct state
   b. Player belongs to room
   c. It is this player's turn (for game actions)
   d. Action-specific validation
3. If invalid: respond with error callback
4. If valid:
   a. Update game state in memory/DB
   b. Send private data to acting player (if any)
   c. Broadcast public state update to room
   d. Advance turn if action is complete
   e. Check for round/game end conditions
```

### Pattern: Multi-step Actions

Some actions require multiple exchanges:

```
Draw from Deck:
  Client: playerAction { type: 'drawDeck' }
  Server -> Client: cardDrawn { card }
  Client: discardChoice { ... }
  Server -> Room: gameStateUpdated
  (If red face card -> additional special effect exchange)

Take from Discard:
  Client: playerAction { type: 'takeDiscard' }
  Server -> Client: (card is already known - top of discard)
  Client: discardFromTake { discardSlot }
  Server -> Room: gameStateUpdated

Burn:
  Client: playerAction { type: 'burn', slot }
  Server -> Room: burnResult { success, ... }
  Server -> Room: gameStateUpdated
```

---

## Implementation Guidelines

1. **Use rooms**: Every socket joins a Socket.io room by roomCode. Use `io.to(roomCode).emit()` for broadcasts.
2. **Track socket-player mapping**: Maintain a Map of socketId <-> { playerId, roomCode } for disconnect handling.
3. **Use callbacks for acknowledgements**: `socket.on('createRoom', (data, callback) => { callback({ success: true, ... }) })`
4. **Namespace events clearly**: Prefix all events consistently. Use camelCase.
5. **Debounce rapid actions**: Ignore duplicate actions if previous action is still processing.
6. **Log all events**: Log incoming events and outgoing broadcasts for debugging multiplayer issues.
7. **Timeout special effects**: If a player takes too long on a special effect choice (e.g., Red King), apply a default action (return both) after 30 seconds.

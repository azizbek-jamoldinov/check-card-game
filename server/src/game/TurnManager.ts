import type { GameState, ActionType } from '../types/game.types';

// ============================================================
// Turn System Core (F-033 to F-036)
// ============================================================

/**
 * Validates that a given player is the current-turn player.
 * Returns an error message if invalid, or null if valid.
 * (F-034)
 */
export function validatePlayerTurn(gameState: GameState, playerId: string): string | null {
  if (gameState.phase !== 'playing') {
    return 'Game is not in playing phase';
  }

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  if (!currentPlayer) {
    return 'Invalid turn index';
  }

  if (currentPlayer.playerId !== playerId) {
    return 'It is not your turn';
  }

  return null;
}

/**
 * Returns the available actions for the current player.
 * Discard take is only available when the discard pile is non-empty.
 * Burn is only available when the discard pile is non-empty (need a card to match against).
 * (F-035)
 */
export function getAvailableActions(gameState: GameState): ActionType[] {
  const actions: ActionType[] = ['drawDeck'];

  if (gameState.discardPile.length > 0) {
    actions.push('takeDiscard');
    actions.push('burn');
  }

  return actions;
}

/**
 * Advances the turn to the next player in order.
 * Wraps around to index 0 when reaching the end of the player list.
 * Returns the new currentTurnIndex.
 * (F-033)
 */
export function advanceTurn(gameState: GameState): number {
  const playerCount = gameState.players.length;
  if (playerCount === 0) return 0;

  const nextIndex = (gameState.currentTurnIndex + 1) % playerCount;
  gameState.currentTurnIndex = nextIndex;

  return nextIndex;
}

/**
 * Checks whether the round should end.
 * The round ends when check has been called and the turn returns to the checker.
 * (Used by check mechanism — F-064, prepared here for future use)
 */
export function isRoundOver(gameState: GameState): boolean {
  if (!gameState.checkCalledBy) return false;

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  return currentPlayer?.playerId === gameState.checkCalledBy;
}

/**
 * Transitions the game from 'peeking' phase to 'playing' phase.
 * Called when all players have finished peeking at their initial cards.
 */
export function transitionFromPeeking(gameState: GameState): void {
  if (gameState.phase !== 'peeking') return;
  gameState.phase = 'playing';
}

/**
 * Gets the current turn player's ID.
 */
export function getCurrentTurnPlayerId(gameState: GameState): string | null {
  const player = gameState.players[gameState.currentTurnIndex];
  return player?.playerId ?? null;
}

// ============================================================
// Remove Player from Active Game
// ============================================================

export interface RemovePlayerResult {
  /** Whether the player was found and removed */
  removed: boolean;
  /** Whether the current turn player changed (need to emit yourTurn) */
  turnChanged: boolean;
  /** Whether the game should end (fewer than 2 players remain) */
  gameEnded: boolean;
  /** Username of the removed player */
  username: string | null;
}

/**
 * Removes a player from an active game, handling:
 * - Discarding their hand cards to the discard pile
 * - Clearing any pending drawn card if it belongs to the leaving player
 * - Fixing currentTurnIndex to avoid index corruption
 * - Clearing checkCalledBy if the leaving player called check
 * - Ending the game if fewer than 2 players remain
 */
export function removePlayerFromGame(gameState: GameState, playerId: string): RemovePlayerResult {
  const playerIndex = gameState.players.findIndex((p) => p.playerId === playerId);
  if (playerIndex === -1) {
    return { removed: false, turnChanged: false, gameEnded: false, username: null };
  }

  const player = gameState.players[playerIndex];
  const wasCurrentTurn = gameState.currentTurnIndex === playerIndex;

  // 1. Discard the player's hand cards
  for (const slot of player.hand) {
    gameState.discardPile.push(slot.card);
  }

  // 2. Clear pending drawn card if this player had one
  if (gameState.drawnByPlayerId === playerId) {
    if (gameState.drawnCard) {
      gameState.discardPile.push(gameState.drawnCard);
    }
    gameState.drawnCard = null;
    gameState.drawnByPlayerId = null;
    gameState.drawnSource = null;
  }

  // 3. Clear check if this player called it
  if (gameState.checkCalledBy === playerId) {
    gameState.checkCalledBy = null;
    gameState.checkCalledAtIndex = null;
  }

  // 4. Remove the player from the array
  gameState.players.splice(playerIndex, 1);

  // 5. Check if game should end
  if (gameState.players.length < 2) {
    gameState.phase = 'roundEnd';
    return { removed: true, turnChanged: false, gameEnded: true, username: player.username };
  }

  // 6. Fix currentTurnIndex
  let turnChanged = false;
  if (wasCurrentTurn) {
    // The removed player had the turn — the next player (now at the same index) gets it
    // But we need to wrap if we removed the last player in the array
    gameState.currentTurnIndex = gameState.currentTurnIndex % gameState.players.length;
    turnChanged = true;
  } else if (gameState.currentTurnIndex > playerIndex) {
    // A player before the current turn was removed, shift index back
    gameState.currentTurnIndex--;
  }
  // If currentTurnIndex < playerIndex, no change needed

  return { removed: true, turnChanged, gameEnded: false, username: player.username };
}

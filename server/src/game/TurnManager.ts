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

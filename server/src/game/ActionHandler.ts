import type { Card, GameState, SlotLabel } from '../types/game.types';
import { drawFromDeck, addToDiscard } from './Deck';

// ============================================================
// Draw from Deck — Phase 1 (F-037)
// ============================================================

/**
 * Draws a card from the deck and stores it as a pending drawn card.
 * Returns the drawn card, or null if the deck is empty.
 * Mutates gameState: removes card from deck, sets drawnCard and drawnByPlayerId.
 */
export function handleDrawFromDeck(gameState: GameState, playerId: string): Card | null {
  if (gameState.drawnCard !== null) {
    return null; // Already has a pending drawn card
  }

  const card = drawFromDeck(gameState);
  if (!card) return null;

  gameState.drawnCard = card;
  gameState.drawnByPlayerId = playerId;

  return card;
}

// ============================================================
// Discard Choice — Phase 2 (F-038, F-039)
// ============================================================

export interface DiscardChoiceResult {
  success: boolean;
  error?: string;
  /** The card that was placed on the discard pile */
  discardedCard?: Card;
  /** True if the discarded card was the drawn card (not a hand card) */
  discardedDrawnCard?: boolean;
  /** True if the discarded card triggers a special effect (red J/Q/K just drawn) */
  triggersSpecialEffect?: boolean;
}

/**
 * Validates a discard choice after drawing from deck.
 * Returns an error string if invalid, null if valid.
 */
export function validateDiscardChoice(
  gameState: GameState,
  playerId: string,
  slot: string | null,
): string | null {
  if (!gameState.drawnCard || gameState.drawnByPlayerId !== playerId) {
    return 'No pending drawn card';
  }

  const player = gameState.players.find((p) => p.playerId === playerId);
  if (!player) {
    return 'Player not found';
  }

  // slot === null means "discard the drawn card"
  if (slot !== null) {
    const handSlot = player.hand.find((h) => h.slot === slot);
    if (!handSlot) {
      return `Invalid slot: ${slot}`;
    }
  }

  return null;
}

/**
 * Processes a discard choice after drawing from deck.
 *
 * - slot === null: discard the drawn card (keep hand unchanged)
 * - slot === 'A'|'B'|etc: replace that hand card with the drawn card, discard the hand card
 *
 * Mutates gameState. Clears drawnCard/drawnByPlayerId.
 * Returns result with the discarded card and whether it triggers a special effect.
 */
export function processDiscardChoice(
  gameState: GameState,
  playerId: string,
  slot: SlotLabel | null,
): DiscardChoiceResult {
  const validationError = validateDiscardChoice(gameState, playerId, slot);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const drawnCard = gameState.drawnCard!;
  const player = gameState.players.find((p) => p.playerId === playerId)!;

  let discardedCard: Card;
  let discardedDrawnCard: boolean;

  if (slot === null) {
    // Discard the drawn card itself
    discardedCard = drawnCard;
    discardedDrawnCard = true;
  } else {
    // Replace hand card with drawn card
    const handSlot = player.hand.find((h) => h.slot === slot)!;
    discardedCard = handSlot.card;
    handSlot.card = drawnCard;
    discardedDrawnCard = false;
  }

  // Place discarded card on discard pile
  addToDiscard(gameState, discardedCard);

  // Check for special effect: red J/Q/K that was just drawn from deck and then discarded
  // (F-040) — only triggers when the drawn card itself is discarded
  const triggersSpecialEffect = discardedDrawnCard && isRedFaceCard(discardedCard);

  // Clear pending draw state
  gameState.drawnCard = null;
  gameState.drawnByPlayerId = null;

  return {
    success: true,
    discardedCard,
    discardedDrawnCard,
    triggersSpecialEffect,
  };
}

// ============================================================
// Helper: Red Face Card Detection (F-040)
// ============================================================

/**
 * Returns true if the card is a red Jack, Queen, or King.
 * These trigger special effects when drawn from deck and then discarded.
 */
export function isRedFaceCard(card: Card): boolean {
  return card.isRed && (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K');
}

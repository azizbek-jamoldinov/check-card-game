import type { Card } from './card.types';
import type { ClientPlayerState, SlotLabel } from './player.types';

// ============================================================
// Game Phase
// ============================================================

export type GamePhase = 'dealing' | 'peeking' | 'playing' | 'roundEnd' | 'gameEnd';

// ============================================================
// Client Game State (F-014)
// ============================================================

export interface ClientGameState {
  deckCount: number;
  discardPile: Card[];
  players: ClientPlayerState[];
  currentTurnIndex: number;
  checkCalledBy: string | null;
  roundNumber: number;
  scores: Record<string, number>;
  phase: GamePhase;
}

// ============================================================
// Room Types
// ============================================================

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomPlayer {
  id: string;
  username: string;
}

export interface RoomData {
  roomCode: string;
  host: string;
  players: RoomPlayer[];
  status: RoomStatus;
}

// ============================================================
// Action Types
// ============================================================

export type ActionType = 'drawDeck' | 'takeDiscard' | 'burn';

export interface PlayerAction {
  type: ActionType;
  discardSlot?: SlotLabel;
  burnSlot?: SlotLabel;
}

export interface RedKingChoice {
  keepIndices: number[];
  discardSlots: SlotLabel[];
}

// ============================================================
// Socket Event Payload Types
// ============================================================

export interface PeekedCard {
  slot: SlotLabel;
  card: Card;
}

export type SpecialEffectType = 'redJack' | 'redQueen' | 'redKing';

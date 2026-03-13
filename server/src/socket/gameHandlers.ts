import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomModel } from '../models/Room';
import { sanitizeGameState } from '../game/GameSetup';
import {
  validatePlayerTurn,
  getAvailableActions,
  transitionFromPeeking,
  getCurrentTurnPlayerId,
} from '../game/TurnManager';
import { getSocketByPlayer } from './playerMapping';
import type { GameState, ActionType } from '../types/game.types';

// ============================================================
// Helper: Broadcast personalized game state to all players (F-036)
// ============================================================

export async function broadcastGameState(
  io: SocketIOServer,
  _roomCode: string,
  gameState: GameState,
): Promise<void> {
  for (const player of gameState.players) {
    const socketId = getSocketByPlayer(player.playerId);
    if (!socketId) continue;

    const clientState = sanitizeGameState(gameState, player.playerId);
    io.to(socketId).emit('gameStateUpdated', clientState);
  }
}

/**
 * Sends a 'yourTurn' notification to the current turn player.
 * (F-036)
 */
function emitYourTurn(io: SocketIOServer, gameState: GameState): void {
  const turnPlayerId = getCurrentTurnPlayerId(gameState);
  if (!turnPlayerId) return;

  const socketId = getSocketByPlayer(turnPlayerId);
  if (!socketId) return;

  io.to(socketId).emit('yourTurn', {
    playerId: turnPlayerId,
    canCheck: gameState.checkCalledBy === null,
    availableActions: getAvailableActions(gameState),
  });
}

// ============================================================
// Game Event Handlers (F-033 to F-036)
// ============================================================

export function registerGameHandlers(io: SocketIOServer, socket: Socket): void {
  // ----------------------------------------------------------
  // endPeek — transition from peeking to playing phase
  // ----------------------------------------------------------
  socket.on(
    'endPeek',
    async (
      data: { roomCode: string; playerId: string },
      callback?: (response: { success: boolean; error?: string }) => void,
    ) => {
      try {
        const room = await RoomModel.findOne({ roomCode: data.roomCode });
        if (!room || !room.gameState) {
          callback?.({ success: false, error: 'Room or game not found' });
          return;
        }

        const gameState = room.gameState as unknown as GameState;

        // Only transition if still in peeking phase
        if (gameState.phase !== 'peeking') {
          callback?.({ success: true }); // Already transitioned, no-op
          return;
        }

        // Validate the player is in this room
        const playerInRoom = gameState.players.some((p) => p.playerId === data.playerId);
        if (!playerInRoom) {
          callback?.({ success: false, error: 'Player not in this game' });
          return;
        }

        // Transition to playing phase
        transitionFromPeeking(gameState);

        // Save updated state
        room.gameState = gameState;
        room.markModified('gameState');
        await room.save();

        callback?.({ success: true });

        // Broadcast the updated state to all players
        await broadcastGameState(io, data.roomCode, gameState);

        // Notify the first player it's their turn
        emitYourTurn(io, gameState);

        console.log(`Room ${data.roomCode}: transitioned from peeking to playing`);
      } catch (error) {
        console.error('Error in endPeek:', error);
        callback?.({ success: false, error: 'Failed to end peek phase' });
      }
    },
  );

  // ----------------------------------------------------------
  // playerAction — validate turn and route to action handler
  // (F-033, F-034: Turn validation. Actions implemented in F-037+)
  // ----------------------------------------------------------
  socket.on(
    'playerAction',
    async (
      data: { roomCode: string; playerId: string; action: { type: ActionType; slot?: string } },
      callback?: (response: { success: boolean; error?: string }) => void,
    ) => {
      try {
        const room = await RoomModel.findOne({ roomCode: data.roomCode });
        if (!room || !room.gameState) {
          callback?.({ success: false, error: 'Room or game not found' });
          return;
        }

        const gameState = room.gameState as unknown as GameState;

        // F-034: Turn validation
        const turnError = validatePlayerTurn(gameState, data.playerId);
        if (turnError) {
          callback?.({ success: false, error: turnError });
          return;
        }

        // Validate action type
        const available = getAvailableActions(gameState);
        if (!available.includes(data.action.type)) {
          callback?.({ success: false, error: `Action '${data.action.type}' is not available` });
          return;
        }

        // Action-specific handling will be added in Features 7-9
        // For now, acknowledge the valid action request
        callback?.({
          success: false,
          error: 'Action processing not yet implemented',
        });
      } catch (error) {
        console.error('Error in playerAction:', error);
        callback?.({ success: false, error: 'Failed to process action' });
      }
    },
  );
}

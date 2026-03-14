/**
 * Turn Timer — auto-skips a player's turn after TURN_TIMEOUT_MS.
 *
 * Uses in-memory setTimeout handles keyed by roomCode.
 * Only one timer exists per room at a time.
 */

export const TURN_TIMEOUT_MS = 30_000;

/** Map of roomCode → setTimeout handle */
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Starts (or restarts) the turn timer for a room.
 * When the timer fires, calls `onTimeout(roomCode)`.
 */
export function startTurnTimer(roomCode: string, onTimeout: (roomCode: string) => void): void {
  // Clear any existing timer for this room
  clearTurnTimer(roomCode);

  const handle = setTimeout(() => {
    turnTimers.delete(roomCode);
    onTimeout(roomCode);
  }, TURN_TIMEOUT_MS);

  turnTimers.set(roomCode, handle);
}

/**
 * Clears the turn timer for a room (e.g., when the player takes an action in time).
 */
export function clearTurnTimer(roomCode: string): void {
  const handle = turnTimers.get(roomCode);
  if (handle) {
    clearTimeout(handle);
    turnTimers.delete(roomCode);
  }
}

/**
 * Starts a turn timer with a custom duration (F-276).
 * Used when resuming from pause to continue with the remaining time.
 * Minimum duration is clamped to 1000ms.
 */
export function startTurnTimerWithDuration(
  roomCode: string,
  durationMs: number,
  onTimeout: (roomCode: string) => void,
): void {
  clearTurnTimer(roomCode);
  const clamped = Math.max(durationMs, 1000); // at least 1 second
  const handle = setTimeout(() => {
    turnTimers.delete(roomCode);
    onTimeout(roomCode);
  }, clamped);
  turnTimers.set(roomCode, handle);
}

/**
 * Clears all turn timers (used on server shutdown).
 */
export function clearAllTurnTimers(): void {
  for (const handle of turnTimers.values()) {
    clearTimeout(handle);
  }
  turnTimers.clear();
}

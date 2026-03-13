import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startTurnTimer,
  clearTurnTimer,
  clearAllTurnTimers,
  TURN_TIMEOUT_MS,
} from '../game/TurnTimer';

// ============================================================
// TurnTimer unit tests
// ============================================================

describe('TurnTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearAllTurnTimers();
    vi.useRealTimers();
  });

  describe('startTurnTimer', () => {
    it('calls onTimeout after TURN_TIMEOUT_MS', () => {
      const onTimeout = vi.fn();
      startTurnTimer('ROOM1', onTimeout);

      // Not yet fired
      vi.advanceTimersByTime(TURN_TIMEOUT_MS - 1);
      expect(onTimeout).not.toHaveBeenCalled();

      // Now fires
      vi.advanceTimersByTime(1);
      expect(onTimeout).toHaveBeenCalledOnce();
      expect(onTimeout).toHaveBeenCalledWith('ROOM1');
    });

    it('passes the roomCode to onTimeout', () => {
      const onTimeout = vi.fn();
      startTurnTimer('ABCD', onTimeout);

      vi.advanceTimersByTime(TURN_TIMEOUT_MS);
      expect(onTimeout).toHaveBeenCalledWith('ABCD');
    });

    it('clears previous timer when called again for the same room', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      startTurnTimer('ROOM1', onTimeout1);
      vi.advanceTimersByTime(15_000); // halfway

      // Restart with new callback
      startTurnTimer('ROOM1', onTimeout2);

      // Advance past when the first timer would have fired
      vi.advanceTimersByTime(20_000);
      expect(onTimeout1).not.toHaveBeenCalled();

      // Advance to when the second timer fires
      vi.advanceTimersByTime(10_000);
      expect(onTimeout2).toHaveBeenCalledOnce();
    });

    it('supports multiple rooms independently', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      startTurnTimer('ROOM1', onTimeout1);
      vi.advanceTimersByTime(10_000);
      startTurnTimer('ROOM2', onTimeout2);

      // ROOM1 fires after 30s total (20s more)
      vi.advanceTimersByTime(20_000);
      expect(onTimeout1).toHaveBeenCalledOnce();
      expect(onTimeout2).not.toHaveBeenCalled();

      // ROOM2 fires after another 10s
      vi.advanceTimersByTime(10_000);
      expect(onTimeout2).toHaveBeenCalledOnce();
    });
  });

  describe('clearTurnTimer', () => {
    it('prevents the timer from firing', () => {
      const onTimeout = vi.fn();
      startTurnTimer('ROOM1', onTimeout);

      vi.advanceTimersByTime(15_000);
      clearTurnTimer('ROOM1');

      vi.advanceTimersByTime(20_000);
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('does nothing for a room without a timer', () => {
      // Should not throw
      expect(() => clearTurnTimer('NONEXISTENT')).not.toThrow();
    });

    it('only clears the specified room timer', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      startTurnTimer('ROOM1', onTimeout1);
      startTurnTimer('ROOM2', onTimeout2);

      clearTurnTimer('ROOM1');

      vi.advanceTimersByTime(TURN_TIMEOUT_MS);
      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).toHaveBeenCalledOnce();
    });
  });

  describe('clearAllTurnTimers', () => {
    it('prevents all timers from firing', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();
      const onTimeout3 = vi.fn();

      startTurnTimer('ROOM1', onTimeout1);
      startTurnTimer('ROOM2', onTimeout2);
      startTurnTimer('ROOM3', onTimeout3);

      clearAllTurnTimers();

      vi.advanceTimersByTime(TURN_TIMEOUT_MS * 2);
      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).not.toHaveBeenCalled();
      expect(onTimeout3).not.toHaveBeenCalled();
    });

    it('works when no timers are active', () => {
      expect(() => clearAllTurnTimers()).not.toThrow();
    });
  });

  describe('TURN_TIMEOUT_MS', () => {
    it('is 30 seconds', () => {
      expect(TURN_TIMEOUT_MS).toBe(30_000);
    });
  });
});

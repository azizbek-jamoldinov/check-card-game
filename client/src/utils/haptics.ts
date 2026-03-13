/**
 * Haptic feedback utility using the Vibration API.
 * Silently no-ops on devices/browsers that don't support it.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration API may throw in some environments — ignore
    }
  }
}

/** Short tap — card interaction, draw, swap */
export function vibrateTap(): void {
  vibrate(15);
}

/** Success — burn success */
export function vibrateSuccess(): void {
  vibrate([30, 50, 30]);
}

/** Warning — burn failure, penalty */
export function vibrateWarning(): void {
  vibrate([50, 30, 80]);
}

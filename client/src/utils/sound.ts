/**
 * Simple sound effect utility.
 * Preloads the pick sound and provides a function to play it.
 */

const pickAudio = new Audio('/pick.mp3');
pickAudio.preload = 'auto';

/**
 * Play the card pick / action sound effect.
 * Non-blocking — errors are silently ignored (e.g. browser autoplay policy).
 */
export function playPickSound(): void {
  // Clone the audio node so overlapping plays don't cut each other off
  const clone = pickAudio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.5;
  clone.play().catch(() => {
    // Autoplay may be blocked until user interacts — ignore
  });
}

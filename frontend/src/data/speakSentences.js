/** Helpers for guided speaking timing (sentence bank removed — unused). */

export function listenMsForSentence(text) {
  const len = String(text || '').replace(/\s+/g, '').length
  // Longer lines need more mic time; clamp 5–9s
  return Math.min(9000, Math.max(5000, 3500 + len * 45))
}

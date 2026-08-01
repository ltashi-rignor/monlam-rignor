/** Lazy-load the large Tibetan stroke-trace dataset once. */
import { normalizeDoc, normalizeBrush } from './traceCore'

let loadPromise = null
let cached = null

export async function loadTraceData() {
  if (cached) return cached
  if (!loadPromise) {
    loadPromise = import('../data/tibetanTraceLetters.json').then((mod) => {
      const traceDoc = mod.default || mod
      cached = {
        letters: normalizeDoc(traceDoc),
        brush: normalizeBrush(traceDoc.brush),
        byGlyph: null,
      }
      cached.byGlyph = Object.fromEntries(cached.letters.map((L) => [L.glyph, L]))
      return cached
    })
  }
  return loadPromise
}

/** Local vocab packs when Melong / API is unavailable — from ``content/vocab_rain.yaml``. */
import { parse } from 'yaml'
import raw from '@content/vocab_rain.yaml?raw'

const data = parse(raw) || {}
const PACKS = data.packs || {}

export function localVocabPack(theme = 'animals', count = 28, exclude = []) {
  const key = PACKS[theme] ? theme : 'animals'
  const excludeSet = new Set((exclude || []).map((t) => String(t || '').trim()).filter(Boolean))
  let pool = (PACKS[key] || []).filter((w) => w?.tibetan && !excludeSet.has(w.tibetan))
  if (pool.length < Math.min(8, count)) {
    pool = Object.values(PACKS)
      .flat()
      .filter((w) => w?.tibetan && !excludeSet.has(w.tibetan))
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const words = shuffled.slice(0, count).map((w, i) => {
    const english = w.english || ''
    const wylie = w.wylie || ''
    const answers = [
      ...String(english)
        .split(/[/|,;]/)
        .map((p) =>
          String(p)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        ),
      String(english)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      String(wylie)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ].filter(Boolean)
    return {
      id: `fb-${theme}-${i}-${w.tibetan}`,
      tibetan: w.tibetan,
      english,
      wylie,
      answers: [...new Set(answers)],
      theme: key,
    }
  })
  return { theme: key, words, source: 'fallback' }
}

export function fallbackThemes() {
  return Object.keys(PACKS)
}

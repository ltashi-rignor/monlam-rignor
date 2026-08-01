/** Theme journey helpers for Flashcards (མིང་ཚིག་ཤོག་བུ།). */

import { VOCAB } from './tibetan'

export const VOCAB_THEMES = [
  { id: 'greetings', key: 'greetings', label: 'འཚམས་འདྲི།' },
  { id: 'family', key: 'family', label: 'ནང་མི།' },
  { id: 'nature', key: 'nature', label: 'རང་བྱུང།' },
  { id: 'animals', key: 'animals', label: 'སྲོག་ཆགས།' },
  { id: 'food', key: 'food', label: 'ཟས་རིགས།' },
  { id: 'pronouns', key: 'pronouns', label: 'མིང་ཚབ།' },
  { id: 'numbers', key: 'numbers', label: 'གྲངས་ཀ།' },
]

const BY_ID = Object.fromEntries(VOCAB.map((w) => [w.id, w]))

export function wordById(id) {
  return BY_ID[id] || null
}

export function themeWords(theme) {
  const key = theme?.key || theme?.id
  return VOCAB.filter((w) => w.theme === key)
}

/** Theme index unlocked if previous theme is fully mastered (index 0 always open). */
export function isThemeUnlocked(themeIndex, masteredIds) {
  if (themeIndex <= 0) return true
  const prev = VOCAB_THEMES[themeIndex - 1]
  if (!prev) return true
  const mastered = new Set(masteredIds || [])
  const words = themeWords(prev)
  return words.length > 0 && words.every((w) => mastered.has(w.id))
}

export function themeProgress(theme, masteredIds) {
  const words = themeWords(theme)
  const mastered = new Set(masteredIds || [])
  const done = words.filter((w) => mastered.has(w.id)).length
  return {
    done,
    total: words.length,
    complete: words.length > 0 && done === words.length,
  }
}

export function unlockedWords(masteredIds) {
  const out = []
  VOCAB_THEMES.forEach((theme, i) => {
    if (isThemeUnlocked(i, masteredIds)) out.push(...themeWords(theme))
  })
  return out
}

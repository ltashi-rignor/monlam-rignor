/** Traditional ཀ་ཁ་ row journey + kid example words for Alphabet. */

import { CONSONANTS } from './tibetan'

export const CONSONANT_ROWS = [
  { id: 'ka', label: 'ཀ་སྡེ།', letters: ['ཀ', 'ཁ', 'ག', 'ང'] },
  { id: 'ca', label: 'ཅ་སྡེ།', letters: ['ཅ', 'ཆ', 'ཇ', 'ཉ'] },
  { id: 'ta', label: 'ཏ་སྡེ།', letters: ['ཏ', 'ཐ', 'ད', 'ན'] },
  { id: 'pa', label: 'པ་སྡེ།', letters: ['པ', 'ཕ', 'བ', 'མ'] },
  { id: 'tsa', label: 'ཙ་སྡེ།', letters: ['ཙ', 'ཚ', 'ཛ', 'ཝ'] },
  { id: 'zha', label: 'ཞ་སྡེ།', letters: ['ཞ', 'ཟ', 'འ', 'ཡ'] },
  { id: 'ra', label: 'ར་སྡེ།', letters: ['ར', 'ལ', 'ཤ', 'ས'] },
  { id: 'ha', label: 'ཧ་སྡེ།', letters: ['ཧ', 'ཨ'] },
]

/** One kid-friendly word highlighting each consonant. */
export const LETTER_EXAMPLES = {
  ཀ: { word: 'ཀ་ར།', meaning: 'sugar', wylie: 'ka ra' },
  ཁ: { word: 'ཁྱི།', meaning: 'dog', wylie: 'khyi' },
  ག: { word: 'གངས།', meaning: 'snow', wylie: 'gangs' },
  ང: { word: 'ང་།', meaning: 'I / me', wylie: 'nga' },
  ཅ: { word: 'ཅོག་ཙེ།', meaning: 'table', wylie: 'cog tse' },
  ཆ: { word: 'ཆུ།', meaning: 'water', wylie: 'chu' },
  ཇ: { word: 'ཇ།', meaning: 'tea', wylie: 'ja' },
  ཉ: { word: 'ཉ།', meaning: 'fish', wylie: 'nya' },
  ཏ: { word: 'ཏ་ལ།', meaning: 'palm tree', wylie: 'ta la' },
  ཐ: { word: 'ཐུག་པ།', meaning: 'noodle soup', wylie: 'thug pa' },
  ད: { word: 'དེབ།', meaning: 'book', wylie: 'deb' },
  ན: { word: 'ནམ་མཁའ།', meaning: 'sky', wylie: 'nam mkha\'' },
  པ: { word: 'པད་མ།', meaning: 'lotus', wylie: 'pad ma' },
  ཕ: { word: 'ཕོ་རོག', meaning: 'raven', wylie: 'pho rog' },
  བ: { word: 'བུ།', meaning: 'boy / son', wylie: 'bu' },
  མ: { word: 'མེ།', meaning: 'fire', wylie: 'me' },
  ཙ: { word: 'ཙི་ཙི།', meaning: 'mouse', wylie: 'tsi tsi' },
  ཚ: { word: 'ཚ་བ།', meaning: 'hot', wylie: 'tsha ba' },
  ཛ: { word: 'ཛ་ཏི།', meaning: 'nutmeg', wylie: 'dza ti' },
  ཝ: { word: 'ཝ་མོ།', meaning: 'fox', wylie: 'wa mo' },
  ཞ: { word: 'ཞི་མི།', meaning: 'cat', wylie: 'zhi mi' },
  ཟ: { word: 'ཟས།', meaning: 'food', wylie: 'zas' },
  འ: { word: 'འོ་མ།', meaning: 'milk', wylie: "'o ma" },
  ཡ: { word: 'ཡི་གེ།', meaning: 'letter', wylie: 'yi ge' },
  ར: { word: 'རི།', meaning: 'mountain', wylie: 'ri' },
  ལ: { word: 'ལག་པ།', meaning: 'hand', wylie: 'lag pa' },
  ཤ: { word: 'ཤིང་།', meaning: 'tree', wylie: 'shing' },
  ས: { word: 'སེམས།', meaning: 'mind', wylie: 'sems' },
  ཧ: { word: 'ཧ་ཧ།', meaning: 'ha ha (laugh)', wylie: 'ha ha' },
  ཨ: { word: 'ཨ་མ།', meaning: 'mother', wylie: 'a ma' },
}

const BY_LETTER = Object.fromEntries(CONSONANTS.map((c) => [c.letter, c]))

export function consonantByGlyph(glyph) {
  return BY_LETTER[glyph] || null
}

export function rowLetters(row) {
  return row.letters.map((g) => BY_LETTER[g]).filter(Boolean)
}

export function exampleFor(glyph) {
  return LETTER_EXAMPLES[glyph] || null
}

/** Row index unlocked if previous row is fully mastered (row 0 always open). */
export function isRowUnlocked(rowIndex, masteredIds) {
  if (rowIndex <= 0) return true
  const prev = CONSONANT_ROWS[rowIndex - 1]
  if (!prev) return true
  const mastered = new Set(masteredIds || [])
  return rowLetters(prev).every((c) => mastered.has(c.id))
}

export function rowProgress(row, masteredIds) {
  const letters = rowLetters(row)
  const mastered = new Set(masteredIds || [])
  const done = letters.filter((c) => mastered.has(c.id)).length
  return { done, total: letters.length, complete: done === letters.length && letters.length > 0 }
}

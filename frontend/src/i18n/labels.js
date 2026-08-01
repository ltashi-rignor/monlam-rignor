import { useLocaleStore } from '../store/localeStore'

const LESSON_TYPES_BO = {
  alphabet: 'གསལ་བྱེད།',
  vocabulary: 'མིང་ཚིག',
  grammar: 'བརྡ་སྤྲོད།',
  reading: 'ཀློག་པ།',
  writing: 'འབྲི་རྩོམ།',
  speaking: 'སྐད་ཆ།',
  practice: 'སྦྱོང་བརྡར།',
  quiz: 'དྲི་བ།',
  lesson: 'སློབ་ཚན།',
  game: 'རོལ་རྩེད།',
  handwriting: 'ཡིག་གཟུགས།',
  flashcards: 'ཤོག་བུ།',
}

const LESSON_TYPES_EN = {
  alphabet: 'Alphabet',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  practice: 'Practice',
  quiz: 'Quiz',
  lesson: 'Lesson',
  game: 'Game',
  handwriting: 'Handwriting',
  flashcards: 'Flashcards',
}

const STATUSES_BO = {
  pending: 'མ་ཚར།',
  planned: 'འཆར་གཞི།',
  in_progress: 'འགུལ་བཞིན།',
  active: 'འགུལ་བཞིན།',
  completed: 'ཚར་ཟིན།',
  archived: 'ཉར་ཚགས།',
}

const STATUSES_EN = {
  pending: 'Pending',
  planned: 'Planned',
  in_progress: 'In progress',
  active: 'Active',
  completed: 'Done',
  archived: 'Archived',
}

const MISTAKE_TYPES_BO = {
  grammar: 'བརྡ་སྤྲོད།',
  particle: 'ཕྲད།',
  honorific: 'ཞེ་ས།',
  case: 'རྣམ་དབྱེ།',
  spelling: 'ཡིག་ནོར།',
  vocabulary: 'མིང་ཚིག',
  verb: 'བྱ་ཚིག',
  punctuation: 'ཚེག་ཤད།',
  syntax: 'ཚིག་སྦྱོར།',
}

const MISTAKE_TYPES_EN = {
  grammar: 'Grammar',
  particle: 'Particle',
  honorific: 'Honorific',
  case: 'Case',
  spelling: 'Spelling',
  vocabulary: 'Vocabulary',
  verb: 'Verb',
  punctuation: 'Punctuation',
  syntax: 'Syntax',
}

function currentLang(override) {
  const v = override ?? useLocaleStore.getState().lang
  return v === 'en' ? 'en' : 'bo'
}

/** True if string is mostly Latin (Melong English leftovers). */
export function looksEnglish(text) {
  if (!text || typeof text !== 'string') return false
  const tibetan = (text.match(/[\u0F00-\u0FFF]/g) || []).join('').length
  const latin = (text.match(/[A-Za-z]/g) || []).join('').length
  return latin > 3 && latin >= tibetan
}

export function mistakeTypeBo(type, locale) {
  const l = currentLang(locale)
  const map = l === 'en' ? MISTAKE_TYPES_EN : MISTAKE_TYPES_BO
  if (!type) return map.grammar
  if (!looksEnglish(type) && l === 'bo') return type
  const key = String(type).toLowerCase().trim()
  return map[key] || map.grammar
}

export function lessonTypeBo(type, locale) {
  const map = currentLang(locale) === 'en' ? LESSON_TYPES_EN : LESSON_TYPES_BO
  if (!type) return map.lesson
  const key = String(type).toLowerCase().trim()
  return map[key] || type
}

export function statusBo(status, locale) {
  if (!status) return ''
  const map = currentLang(locale) === 'en' ? STATUSES_EN : STATUSES_BO
  const key = String(status).toLowerCase().trim()
  return map[key] || status
}

export function tibetanOrFallback(text, fallback, locale) {
  if (!text) return fallback
  // In English UI, prefer the provided title even if Latin
  if (currentLang(locale) === 'en') return text
  if (looksEnglish(text)) return fallback
  return text
}

export function exerciseCountBo(n, locale) {
  return currentLang(locale) === 'en' ? `${n} exercises` : `དྲི་བ་ ${n}`
}

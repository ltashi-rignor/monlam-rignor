import { bo } from './bo'

const LESSON_TYPES = {
  alphabet: 'གསལ་བྱེད།',
  vocabulary: 'མིང་ཚིག',
  grammar: 'བརྡ་སྤྲོད།',
  reading: 'ཀློག་པ།',
  writing: 'འབྲི་རྩོམ།',
  speaking: 'སྐད་ཆ།',
  practice: 'སྦྱོང་བརྡར།',
  quiz: 'དྲི་བ།',
  lesson: 'སློབ་ཚན།',
}

const STATUSES = {
  pending: 'མ་ཚར།',
  planned: 'འཆར་གཞི།',
  in_progress: 'འགུལ་བཞིན།',
  active: 'འགུལ་བཞིན།',
  completed: 'ཚར་ཟིན།',
  archived: 'ཉར་ཚགས།',
}

/** True if string is mostly Latin (Melong English leftovers). */
export function looksEnglish(text) {
  if (!text || typeof text !== 'string') return false
  const tibetan = (text.match(/[\u0F00-\u0FFF]/g) || []).join('').length
  const latin = (text.match(/[A-Za-z]/g) || []).join('').length
  return latin > 3 && latin >= tibetan
}

const MISTAKE_TYPES = {
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

export function mistakeTypeBo(type) {
  if (!type) return MISTAKE_TYPES.grammar
  if (!looksEnglish(type)) return type
  const key = String(type).toLowerCase().trim()
  return MISTAKE_TYPES[key] || MISTAKE_TYPES.grammar
}

export function lessonTypeBo(type) {
  if (!type) return LESSON_TYPES.lesson
  const key = String(type).toLowerCase().trim()
  return LESSON_TYPES[key] || type
}

export function statusBo(status) {
  if (!status) return ''
  const key = String(status).toLowerCase().trim()
  return STATUSES[key] || status
}

export function tibetanOrFallback(text, fallback) {
  if (!text) return fallback
  if (looksEnglish(text)) return fallback
  return text
}

export function exerciseCountBo(n) {
  return `དྲི་བ་ ${n}`
}

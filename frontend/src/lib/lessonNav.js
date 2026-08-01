/** Resolve where a learning-path lesson should open. */
export function lessonDestination(lesson) {
  if (!lesson) return null
  const type = String(lesson.lesson_type || '').toLowerCase().trim()
  const id = lesson.id != null ? String(lesson.id) : ''

  if (type === 'game' || type.includes('game')) return '/letter-party'
  if (type === 'handwriting' || type.includes('handwriting')) return '/handwriting'
  if (type === 'alphabet' || type.includes('alphabet')) return '/alphabet'
  if (type === 'flashcards' || type.includes('flash')) return '/flashcards'
  if (id) return `/lessons/${id}`
  return null
}

export function isActivityLesson(lesson) {
  const type = String(lesson?.lesson_type || '').toLowerCase()
  return (
    type.includes('game') ||
    type.includes('handwriting') ||
    type.includes('alphabet') ||
    type.includes('flash')
  )
}

export function sameLessonId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

export function lessonTypeGlyph(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('game')) return 'ཆར'
  if (t.includes('handwriting')) return 'ཀ'
  if (t.includes('alphabet')) return 'ཨ'
  if (t.includes('flash')) return 'ཤོག'
  if (t.includes('grammar')) return 'བརྡ'
  if (t.includes('vocab')) return 'མིང'
  if (t.includes('speak')) return 'སྐད'
  if (t.includes('read')) return 'ཀློག'
  if (t.includes('writ')) return 'འབྲི'
  if (t.includes('practice') || t.includes('quiz')) return 'སྦྱོང'
  return 'སློབ'
}

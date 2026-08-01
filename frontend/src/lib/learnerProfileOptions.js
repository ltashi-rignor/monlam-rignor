/** Option catalogs for the AI learner profile wizard. */

export const GOAL_OPTIONS = [
  'speak_everyday',
  'read_texts',
  'write_tibetan',
  'classical_grammar',
  'buddhist_scriptures',
  'conversational',
  'exams',
  'pronunciation',
  'travel',
  'teach',
  'research',
  'other',
]

export const VARIETY_OPTIONS = ['modern', 'classical', 'both', 'unsure']

export const NATIVE_LANG_OPTIONS = [
  'en',
  'hi',
  'zh',
  'ne',
  'bo',
  'ja',
  'ko',
  'other',
]

export const ABILITY_SKILLS = ['listening', 'speaking', 'reading', 'writing']

export const SCRIPT_OPTIONS = ['uchen', 'ume', 'both', 'neither']

export const ALPHABET_OPTIONS = [
  'vowels',
  'consonants',
  'prefixes',
  'suffixes',
  'stacks',
  'silent_letters',
]

export const GRAMMAR_KEYS = [
  'sentence_structure',
  'particles',
  'honorific',
  'verbs',
  'tenses',
  'case_markers',
]

export const PRONUNCIATION_OPTIONS = [
  'read_aloud',
  'identify_tones',
  'pronounce_stacks',
  'distinguish_sounds',
]

export const VOCAB_OPTIONS = ['0', '100', '500', '1000', '3000+']

export const INTEREST_OPTIONS = [
  'daily_conversation',
  'family',
  'travel',
  'food',
  'religion',
  'buddhism',
  'news',
  'stories',
  'childrens_books',
  'literature',
  'business',
  'medicine',
  'technology',
  'culture',
  'history',
  'songs',
  'poetry',
]

export const STYLE_OPTIONS = [
  'videos',
  'reading',
  'speaking',
  'games',
  'stories',
  'flashcards',
  'writing',
  'ai_tutor',
  'audio',
]

export const TIME_OPTIONS = [5, 10, 20, 30, 60, 0] // 0 = flexible

export const MOTIVATION_OPTIONS = [
  'family',
  'religion',
  'school',
  'work',
  'travel',
  'personal',
  'research',
  'teaching',
]

export const CHALLENGE_OPTIONS = [
  'forget_vocabulary',
  'grammar_confusing',
  'reading_difficult',
  'speaking_confidence',
  'pronunciation',
  'memorization',
  'no_partner',
  'motivation',
]

export const DIFFICULTY_OPTIONS = ['easy', 'balanced', 'challenging', 'adaptive']

export const LESSON_LENGTH_OPTIONS = [5, 10, 15, 20, 30]

export const STEPS = [
  'basics',
  'ability',
  'script',
  'knowledge',
  'interests',
  'schedule',
  'prefs',
  'placement',
]

export function emptyProfile() {
  return {
    goals: [],
    goal_other: '',
    tibetan_variety: '',
    native_language: '',
    native_language_other: '',
    ability: {
      listening: null,
      speaking: null,
      reading: null,
      writing: null,
    },
    scripts: [],
    alphabet: [],
    grammar_confidence: Object.fromEntries(GRAMMAR_KEYS.map((k) => [k, null])),
    pronunciation: [],
    vocabulary_size: '',
    interests: [],
    learning_styles: [],
    daily_minutes: null,
    weekly_goal: '',
    motivations: [],
    challenges: [],
    difficulty: 'adaptive',
    lesson_minutes: 15,
    ai_prefs: {
      mistake_timing: 'immediate',
      reminders: true,
      focus: 'balanced',
      cultural_notes: true,
      gamification: true,
      feedback_style: 'gentle',
    },
    accessibility: {
      device: 'phone',
      slow_internet: false,
      font_size: 'normal',
      high_contrast: false,
      dyslexia_friendly: false,
      audio_first: false,
    },
    placement: null,
  }
}

export function profileFromUser(user) {
  const base = emptyProfile()
  const existing = user?.learner_profile && typeof user.learner_profile === 'object'
    ? user.learner_profile
    : {}
  return {
    ...base,
    ...existing,
    ability: { ...base.ability, ...(existing.ability || {}) },
    grammar_confidence: {
      ...base.grammar_confidence,
      ...(existing.grammar_confidence || {}),
    },
    ai_prefs: { ...base.ai_prefs, ...(existing.ai_prefs || {}) },
    accessibility: { ...base.accessibility, ...(existing.accessibility || {}) },
  }
}

export function toggleInList(list, value) {
  const arr = Array.isArray(list) ? [...list] : []
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(value)
  return arr
}

export function stepValid(step, form, profile) {
  if (step === 'basics') {
    if (!form.name?.trim()) return false
    if (!profile.goals?.length) return false
    if (!profile.tibetan_variety) return false
    if (!profile.native_language) return false
    return true
  }
  if (step === 'ability') {
    return ABILITY_SKILLS.every((s) => profile.ability?.[s] !== null && profile.ability?.[s] !== undefined)
  }
  if (step === 'script') {
    return Boolean(profile.vocabulary_size) && Array.isArray(profile.scripts) && profile.scripts.length > 0
  }
  if (step === 'schedule') {
    return profile.daily_minutes !== null && profile.daily_minutes !== undefined
  }
  return true
}

/** Tiny placement check — estimates CEFR-ish band without Melong. */
export function scorePlacement(answers) {
  let score = 0
  if (answers.letter === 'ཀ') score += 1
  if (answers.vocab === 'water') score += 1
  if (answers.particle === 'ལ') score += 2
  if (answers.read === 'simple') score += 1
  if (answers.read === 'books') score += 2
  if (answers.write === 'letters') score += 1
  if (answers.write === 'sentences') score += 2
  let band = 'A1'
  if (score >= 7) band = 'B1'
  else if (score >= 5) band = 'A2'
  else if (score >= 3) band = 'A1+'
  return { score, band, answers, taken_at: new Date().toISOString() }
}

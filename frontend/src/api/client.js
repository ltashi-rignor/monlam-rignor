const API_URL = import.meta.env.VITE_API_URL || ''

/** In-flight GET dedupe — StrictMode and rapid nav no longer double-hit the API. */
const inflight = new Map()
/** Short-lived GET cache for snappy page switches. */
const cache = new Map()
const DEFAULT_TTL_MS = 15_000
const SESSION_FLAG = 'mr_session'

let refreshInflight = null
/** Memory-only access token (optional). Prefer httpOnly cookies; never persist JWTs. */
let memoryAccessToken = null

function scrubLegacyTokenStorage() {
  try {
    localStorage.removeItem('mr_token')
    localStorage.removeItem('mr_refresh')
  } catch {
    /* ignore */
  }
}

export function setToken(token) {
  memoryAccessToken = token || null
  scrubLegacyTokenStorage()
  if (!token) {
    try {
      sessionStorage.removeItem(SESSION_FLAG)
    } catch {
      /* ignore */
    }
  }
  clearApiCache()
}

export function setRefreshToken(_token) {
  // Refresh lives in httpOnly cookie only.
  scrubLegacyTokenStorage()
}

export function setSessionTokens({ access_token } = {}) {
  // Prefer httpOnly cookies. Keep a memory JWT only when the API returns a real token
  // (still never written to localStorage).
  memoryAccessToken =
    typeof access_token === 'string' && access_token.includes('.') ? access_token : null
  scrubLegacyTokenStorage()
  try {
    if (access_token) sessionStorage.setItem(SESSION_FLAG, '1')
    else sessionStorage.removeItem(SESSION_FLAG)
  } catch {
    /* ignore */
  }
  clearApiCache()
}

export function markSessionActive() {
  scrubLegacyTokenStorage()
  try {
    sessionStorage.setItem(SESSION_FLAG, '1')
  } catch {
    /* ignore */
  }
}

export function hasSessionHint() {
  try {
    if (sessionStorage.getItem(SESSION_FLAG)) return true
  } catch {
    /* ignore */
  }
  // Migrate: old localStorage sessions still bootstrap once, then scrub.
  try {
    return Boolean(localStorage.getItem('mr_token') || localStorage.getItem('mr_refresh'))
  } catch {
    return false
  }
}

export function clearApiCache(prefix) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

function cacheKey(path, method) {
  return `${method}:${path}`
}

function isPublicPath(pathname) {
  const path = pathname || ''
  return (
    path === '/' ||
    path.startsWith('/about') ||
    path.startsWith('/features') ||
    path.startsWith('/programs') ||
    path.startsWith('/ai') ||
    path.startsWith('/blog') ||
    path.startsWith('/news') ||
    path.startsWith('/faq') ||
    path.startsWith('/contact') ||
    path.startsWith('/login')
  )
}

function clearSessionAndRedirect() {
  setSessionTokens({ access_token: null })
  window.dispatchEvent(new CustomEvent('mr:unauthorized'))
  const path = window.location.pathname || ''
  if (isPublicPath(path)) return
  const next = `${path}${window.location.search || ''}`
  window.location.href = `/login?next=${encodeURIComponent(next)}`
}

async function tryRefreshAccessToken() {
  if (!refreshInflight) {
    refreshInflight = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return null
        setSessionTokens({ access_token: data.access_token })
        return data.access_token || true
      } catch {
        return null
      } finally {
        refreshInflight = null
      }
    })()
  }
  return refreshInflight
}

function buildBody(options) {
  if (options.body == null) return undefined
  if (options.body instanceof FormData) return options.body
  return JSON.stringify(options.body)
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const isForm = options.body instanceof FormData
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }
  if (memoryAccessToken) headers.Authorization = `Bearer ${memoryAccessToken}`

  const ttl = options.ttl
  const useCache = method === 'GET' && ttl !== 0
  const key = cacheKey(path, method)

  if (useCache) {
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return hit.data
  }

  if (method === 'GET' && inflight.has(key)) {
    return inflight.get(key)
  }

  const run = (async () => {
    let res = await fetch(`${API_URL}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
      body: buildBody(options),
    })

    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      const next = await tryRefreshAccessToken()
      if (next) {
        if (typeof next === 'string') headers.Authorization = `Bearer ${next}`
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          method,
          headers,
          credentials: 'include',
          body: buildBody(options),
        })
      } else {
        clearSessionAndRedirect()
      }
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = data.detail
      const message = typeof detail === 'string' ? detail : detail?.[0]?.msg || 'Request failed'
      throw new Error(message)
    }

    if (useCache) {
      const ms = typeof ttl === 'number' ? ttl : DEFAULT_TTL_MS
      cache.set(key, { data, expires: Date.now() + ms })
    }

    if (method !== 'GET') {
      if (path.startsWith('/api/modules')) clearApiCache('GET:/api/modules')
      if (path.startsWith('/api/planner')) clearApiCache('GET:/api/planner')
      if (path.startsWith('/api/auth/me') && method === 'PUT') clearApiCache('GET:/api/auth/me')
      if (path.startsWith('/api/grammar')) clearApiCache('GET:/api/grammar')
      if (path.startsWith('/api/essay')) clearApiCache('GET:/api/essay')
      if (path.startsWith('/api/story')) clearApiCache('GET:/api/story')
      if (path.startsWith('/api/practice')) clearApiCache('GET:/api/practice')
      if (path.startsWith('/api/progress')) {
        clearApiCache('GET:/api/progress')
        clearApiCache('GET:/api/dashboard')
      }
    }

    return data
  })()

  if (method === 'GET') {
    inflight.set(key, run)
    try {
      return await run
    } finally {
      inflight.delete(key)
    }
  }
  return run
}

export const api = {
  request,
  requestOtp: (email) => request('/api/auth/request-otp', { method: 'POST', body: { email } }),
  verifyEmail: (email, code) =>
    request('/api/auth/verify-email', { method: 'POST', body: { email, code } }),
  register: (setup_token, username, password, password_confirm) =>
    request('/api/auth/register', {
      method: 'POST',
      body: { setup_token, username, password, password_confirm },
    }),
  login: (identifier, password) =>
    request('/api/auth/login', { method: 'POST', body: { identifier, password } }),
  refresh: (refresh_token) =>
    request('/api/auth/refresh', {
      method: 'POST',
      body: refresh_token ? { refresh_token } : {},
    }),
  logout: (refresh_token) =>
    request('/api/auth/logout', {
      method: 'POST',
      body: refresh_token ? { refresh_token } : {},
    }),
  me: () => request('/api/auth/me', { ttl: 60_000 }),
  updateProfile: (body) => request('/api/auth/me', { method: 'PUT', body }),
  getRoadmap: () => request('/api/planner/roadmap', { ttl: 0 }),
  generateRoadmap: (regenerate = false) =>
    request('/api/planner/generate', { method: 'POST', body: { regenerate } }),
  getLesson: (id) => request(`/api/planner/lessons/${id}`, { ttl: 30_000 }),
  updateLessonStatus: (id, status) =>
    request(`/api/planner/lessons/${id}/status`, { method: 'POST', body: { status } }),
  checkGrammar: (text) => request('/api/grammar/check', { method: 'POST', body: { text } }),
  extractGrammarFile: (fileOrFiles) => {
    const body = new FormData()
    const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    if (list.length === 1) body.append('file', list[0])
    else list.forEach((f) => body.append('files', f))
    return request('/api/grammar/extract-file', { method: 'POST', body, ttl: 0 })
  },
  checkGrammarFile: (fileOrFiles) => {
    const body = new FormData()
    const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    if (list.length === 1) body.append('file', list[0])
    else list.forEach((f) => body.append('files', f))
    return request('/api/grammar/check-file', { method: 'POST', body, ttl: 0 })
  },
  generateGrammarGame: (topic = 'particles') =>
    request('/api/grammar/game', { method: 'POST', body: { topic }, ttl: 0 }),
  recentGrammarMistakes: (limit = 8) =>
    request(`/api/grammar/recent-mistakes?limit=${limit}`, { ttl: 20_000 }),
  generateStory: (body) => request('/api/story/generate', { method: 'POST', body }),
  storyHistory: () => request('/api/story/history', { ttl: 15_000 }),
  defineStoryWord: (word) => request('/api/story/define', { method: 'POST', body: { word } }),
  generatePractice: (focus, seedMistakes = null) =>
    request('/api/practice/generate', {
      method: 'POST',
      body: {
        focus: focus || null,
        seed_mistakes: Array.isArray(seedMistakes) && seedMistakes.length ? seedMistakes : null,
      },
    }),
  submitPractice: (body) => request('/api/practice/submit', { method: 'POST', body }),
  practiceHistory: () => request('/api/practice/history', { ttl: 15_000 }),
  getProgress: () => request('/api/progress', { ttl: 20_000 }),
  refreshProgress: () => request('/api/progress/refresh', { method: 'POST' }),
  getRecommendations: () => request('/api/recommendations', { ttl: 60_000 }),
  getDashboard: () => request('/api/dashboard/summary', { ttl: 15_000 }),
  getLatestPractice: () => request('/api/practice/latest', { ttl: 15_000 }),
  getModuleProgress: () => request('/api/modules/progress', { ttl: 30_000 }),
  moduleProgress: (kind, item_id, xp = 5) =>
    request('/api/modules/progress', { method: 'POST', body: { kind, item_id, xp } }),
  submitModuleQuiz: (lesson_id, score, total) =>
    request('/api/modules/quiz', { method: 'POST', body: { lesson_id, score, total } }),
  listInteractiveLessons: () => request('/api/modules/lessons', { ttl: 10_000 }),
  getInteractiveLesson: (id, regenerate = false) =>
    request(
      `/api/modules/lessons/${id}${regenerate ? '?regenerate=true' : ''}`,
      { ttl: 0 },
    ),
  regenerateInteractiveLesson: (id) =>
    request(`/api/modules/lessons/${id}/regenerate`, { method: 'POST' }),
  tutorChat: (messages, mode = 'text') =>
    request('/api/tutor/chat', { method: 'POST', body: { messages, mode } }),
  tutorTts: (text, voice_name = 'lhasa_female') =>
    request('/api/tutor/tts', { method: 'POST', body: { text, voice_name }, ttl: 0 }),
  tutorStt: async (blob, filename = 'speech.webm') => {
    const form = new FormData()
    form.append('file', blob, filename)
    form.append('language', 'bo')
    form.append('task', 'transcribe')
    const headers = {}
    if (memoryAccessToken) headers.Authorization = `Bearer ${memoryAccessToken}`
    let res = await fetch(`${API_URL}/api/tutor/stt`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: form,
    })
    if (res.status === 401) {
      const next = await tryRefreshAccessToken()
      if (next) {
        const retryHeaders = {}
        if (typeof next === 'string' && next.includes('.')) {
          retryHeaders.Authorization = `Bearer ${next}`
        } else if (memoryAccessToken) {
          retryHeaders.Authorization = `Bearer ${memoryAccessToken}`
        }
        res = await fetch(`${API_URL}/api/tutor/stt`, {
          method: 'POST',
          headers: retryHeaders,
          credentials: 'include',
          body: form,
        })
      } else {
        clearSessionAndRedirect()
      }
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = data.detail
      const message = typeof detail === 'string' ? detail : detail?.[0]?.msg || 'Request failed'
      throw new Error(message)
    }
    return data
  },
  generateVocabRain: (theme = 'animals', count = 28, difficulty = 'easy', exclude = []) =>
    request('/api/games/vocab-rain', {
      method: 'POST',
      body: { theme, count, difficulty, exclude },
      ttl: 0,
    }),
  cmsPosts: (kind, limit = 20, offset = 0) =>
    request(`/api/cms/posts?kind=${encodeURIComponent(kind)}&limit=${limit}&offset=${offset}`, {
      ttl: 60_000,
    }),
  cmsPost: (kind, slug) =>
    request(`/api/cms/posts/${encodeURIComponent(slug)}?kind=${encodeURIComponent(kind)}`, {
      ttl: 60_000,
    }),
  cmsAnnouncements: (limit = 5) =>
    request(`/api/cms/announcements?limit=${limit}`, { ttl: 60_000 }),
  cmsStats: () => request('/api/cms/stats', { ttl: 120_000 }),
  cmsContact: (body) => request('/api/cms/contact', { method: 'POST', body }),
}

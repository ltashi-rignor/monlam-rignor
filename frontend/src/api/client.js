const API_URL = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('mr_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('mr_token', token)
  else localStorage.removeItem('mr_token')
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail
    const message = typeof detail === 'string' ? detail : detail?.[0]?.msg || 'Request failed'
    throw new Error(message)
  }
  return data
}

export const api = {
  request,
  requestOtp: (email) => request('/api/auth/request-otp', { method: 'POST', body: { email } }),
  verifyOtp: (email, code) => request('/api/auth/verify-otp', { method: 'POST', body: { email, code } }),
  me: () => request('/api/auth/me'),
  updateProfile: (body) => request('/api/auth/me', { method: 'PUT', body }),
  getRoadmap: () => request('/api/planner/roadmap'),
  generateRoadmap: (regenerate = false) =>
    request('/api/planner/generate', { method: 'POST', body: { regenerate } }),
  checkGrammar: (text) => request('/api/grammar/check', { method: 'POST', body: { text } }),
  submitEssay: (body) => request('/api/essay/submit', { method: 'POST', body }),
  essayHistory: () => request('/api/essay/history'),
  generatePractice: (focus) =>
    request('/api/practice/generate', { method: 'POST', body: { focus: focus || null } }),
  submitPractice: (body) => request('/api/practice/submit', { method: 'POST', body }),
  practiceHistory: () => request('/api/practice/history'),
  getProgress: () => request('/api/progress'),
  refreshProgress: () => request('/api/progress/refresh', { method: 'POST' }),
  getRecommendations: () => request('/api/recommendations'),
}

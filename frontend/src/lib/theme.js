const STORAGE_KEY = 'mr_theme'

export function getStoredTheme() {
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'dark' || v === 'light') return v
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(STORAGE_KEY, next)
  return next
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || getStoredTheme()
  return applyTheme(cur === 'dark' ? 'light' : 'dark')
}

export function initTheme() {
  return applyTheme(getStoredTheme())
}

import { create } from 'zustand'

const STORAGE_KEY = 'mr_lang'

function readLang() {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' || v === 'bo' ? v : 'bo'
}

export const useLocaleStore = create((set, get) => ({
  lang: typeof window !== 'undefined' ? readLang() : 'bo',
  setLang(lang) {
    const next = lang === 'en' ? 'en' : 'bo'
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next === 'en' ? 'en' : 'bo'
    document.documentElement.dataset.lang = next
    set({ lang: next })
  },
  toggleLang() {
    get().setLang(get().lang === 'en' ? 'bo' : 'en')
  },
}))

export function initLocale() {
  const lang = readLang()
  document.documentElement.lang = lang === 'en' ? 'en' : 'bo'
  document.documentElement.dataset.lang = lang
  useLocaleStore.setState({ lang })
  return lang
}

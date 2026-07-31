import { create } from 'zustand'
import { api } from '../api/client'

const empty = {
  mastered_letters: [],
  mastered_words: [],
  completed_lessons: [],
  xp: 0,
}

let loadPromise = null

export const useModuleProgressStore = create((set, get) => ({
  progress: empty,
  loading: false,
  loaded: false,
  async ensureLoaded() {
    if (get().loaded) return get().progress
    if (loadPromise) return loadPromise
    set({ loading: true })
    loadPromise = (async () => {
      try {
        const data = await api.getModuleProgress()
        set({ progress: data || empty, loaded: true, loading: false })
        return data || empty
      } catch {
        set({ progress: empty, loaded: true, loading: false })
        return empty
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  },
  async refresh() {
    loadPromise = null
    set({ loading: true })
    try {
      const data = await api.getModuleProgress()
      set({ progress: data || empty, loaded: true, loading: false })
      return data || empty
    } catch {
      set({ loading: false })
      return get().progress
    }
  },
  async markItem(kind, itemId, xp = 5) {
    const data = await api.moduleProgress(kind, itemId, xp)
    set({ progress: data, loaded: true })
    return data
  },
  async submitQuiz(lessonId, score, total) {
    const data = await api.submitModuleQuiz(lessonId, score, total)
    set({ progress: data.progress, loaded: true })
    return data
  },
  reset() {
    loadPromise = null
    set({ progress: empty, loaded: false, loading: false })
  },
}))

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
  error: '',
  async ensureLoaded() {
    if (get().loaded) return get().progress
    if (loadPromise) return loadPromise
    set({ loading: true, error: '' })
    loadPromise = (async () => {
      try {
        const data = await api.getModuleProgress()
        set({ progress: data || empty, loaded: true, loading: false, error: '' })
        return data || empty
      } catch (err) {
        set({
          progress: empty,
          loaded: false,
          loading: false,
          error: err?.message || 'Failed to load progress',
        })
        return empty
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  },
  async refresh() {
    loadPromise = null
    set({ loading: true, error: '' })
    try {
      const data = await api.getModuleProgress()
      set({ progress: data || empty, loaded: true, loading: false, error: '' })
      return data || empty
    } catch (err) {
      set({
        loading: false,
        error: err?.message || 'Failed to refresh progress',
      })
      return get().progress
    }
  },
  async markItem(kind, itemId, xp = 5) {
    const data = await api.moduleProgress(kind, itemId, xp)
    set({ progress: data, loaded: true, error: '' })
    return data
  },
  async submitQuiz(lessonId, score, total) {
    const data = await api.submitModuleQuiz(lessonId, score, total)
    set({ progress: data.progress, loaded: true, error: '' })
    return data
  },
  reset() {
    loadPromise = null
    set({ progress: empty, loaded: false, loading: false, error: '' })
  },
}))

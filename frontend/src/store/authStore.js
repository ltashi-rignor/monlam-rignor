import { create } from 'zustand'
import { api, clearApiCache, setToken } from '../api/client'
import { useModuleProgressStore } from './moduleProgressStore'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  async bootstrap() {
    const token = localStorage.getItem('mr_token')
    if (!token) {
      set({ user: null, loading: false })
      return
    }
    try {
      const user = await api.me()
      set({ user, loading: false })
    } catch {
      setToken(null)
      set({ user: null, loading: false })
    }
  },
  async loginWithOtp(email, code) {
    const res = await api.verifyOtp(email, code)
    setToken(res.access_token)
    clearApiCache()
    useModuleProgressStore.getState().reset()
    const user = await api.me()
    set({ user, loading: false })
    return res
  },
  async refreshUser() {
    const user = await api.me()
    set({ user })
    return user
  },
  logout() {
    setToken(null)
    clearApiCache()
    useModuleProgressStore.getState().reset()
    set({ user: null, loading: false })
  },
}))

import { create } from 'zustand'
import { api, setToken } from '../api/client'

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
    const user = await api.me()
    set({ user })
    return res
  },
  async refreshUser() {
    const user = await api.me()
    set({ user })
    return user
  },
  logout() {
    setToken(null)
    set({ user: null })
  },
}))

import { create } from 'zustand'
import { api, clearApiCache, setRefreshToken, setSessionTokens, setToken } from '../api/client'
import { useModuleProgressStore } from './moduleProgressStore'

async function finishSession(res) {
  setSessionTokens({
    access_token: res.access_token,
    refresh_token: res.refresh_token,
  })
  clearApiCache()
  useModuleProgressStore.getState().reset()
  const user = await api.me()
  return user
}

let listenersBound = false

function bindSessionListeners(get) {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  window.addEventListener('mr:unauthorized', () => {
    get().logout()
  })
  window.addEventListener('storage', (e) => {
    if (e.key === 'mr_token' && !e.newValue) get().logout()
  })
}

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  async bootstrap() {
    bindSessionListeners(get)
    const token = localStorage.getItem('mr_token')
    const refresh = localStorage.getItem('mr_refresh')
    if (!token && !refresh) {
      set({ user: null, loading: false })
      return
    }
    try {
      const user = await api.me()
      set({ user, loading: false })
    } catch {
      setToken(null)
      setRefreshToken(null)
      set({ user: null, loading: false })
    }
  },
  async loginWithPassword(identifier, password) {
    const res = await api.login(identifier, password)
    const user = await finishSession(res)
    set({ user, loading: false })
    return res
  },
  async registerAccount(setupToken, username, password, passwordConfirm) {
    const res = await api.register(setupToken, username, password, passwordConfirm)
    const user = await finishSession(res)
    set({ user, loading: false })
    return res
  },
  async refreshUser() {
    const user = await api.me()
    set({ user })
    return user
  },
  async logout() {
    const refresh = localStorage.getItem('mr_refresh')
    if (refresh) {
      try {
        await api.logout(refresh)
      } catch {
        /* ignore */
      }
    }
    setToken(null)
    setRefreshToken(null)
    clearApiCache()
    useModuleProgressStore.getState().reset()
    set({ user: null, loading: false })
  },
}))

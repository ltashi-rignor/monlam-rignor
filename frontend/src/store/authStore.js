import { create } from 'zustand'
import {
  api,
  clearApiCache,
  hasSessionHint,
  markSessionActive,
  setSessionTokens,
  setToken,
} from '../api/client'
import { useModuleProgressStore } from './moduleProgressStore'

async function finishSession(res) {
  // Cookies are set by the API response; avoid persisting JWTs in localStorage.
  setSessionTokens({ access_token: res?.access_token })
  markSessionActive()
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
}

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  async bootstrap() {
    bindSessionListeners(get)
    const tryMe = async () => {
      const user = await api.me()
      markSessionActive()
      set({ user, loading: false })
    }
    try {
      await tryMe()
    } catch {
      if (!hasSessionHint()) {
        set({ user: null, loading: false })
        return
      }
      try {
        await api.refresh()
        await tryMe()
      } catch {
        setToken(null)
        set({ user: null, loading: false })
      }
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
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    setToken(null)
    clearApiCache()
    useModuleProgressStore.getState().reset()
    set({ user: null, loading: false })
  },
}))

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export const TIBETAN_VOICES = [
  { key: 'lhasa_female', label: 'Lhasa · Female', region: 'ལྷ་ས།' },
  { key: 'lhasa_male', label: 'Lhasa · Male', region: 'ལྷ་ས།' },
  { key: 'amdo_female', label: 'Amdo · Female', region: 'ཨ་མདོ།' },
  { key: 'amdo_male', label: 'Amdo · Male', region: 'ཨ་མདོ།' },
  { key: 'kham_female', label: 'Kham · Female', region: 'ཁམས།' },
  { key: 'kham_male', label: 'Kham · Male', region: 'ཁམས།' },
]

const STORAGE_KEY = 'mr_voice'
const CACHE = new Map()

export function useTibetanVoice() {
  const [voice, setVoice] = useState(() => localStorage.getItem(STORAGE_KEY) || 'lhasa_female')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, voice)
  }, [voice])

  const stop = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {
        /* ignore */
      }
    }
  }, [])

  const speak = useCallback(
    async (text) => {
      if (!text) return
      setError('')
      setLoading(true)
      stop()
      const cacheKey = `${voice}::${text}`
      try {
        let url = CACHE.get(cacheKey)
        if (!url) {
          const data = await api.tutorTts(text, voice)
          url = data.audio_url
          if (url) CACHE.set(cacheKey, url)
        }
        if (!url) throw new Error('No audio returned')
        const a = new Audio(url)
        audioRef.current = a
        a.play().catch(() => {})
      } catch {
        setError('Voice unavailable')
      } finally {
        setLoading(false)
      }
    },
    [voice, stop],
  )

  return { voice, setVoice, speak, stop, loading, error }
}

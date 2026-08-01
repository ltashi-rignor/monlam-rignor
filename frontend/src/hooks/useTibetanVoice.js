import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export const TIBETAN_VOICES = [
  { key: 'lhasa_female', label: 'ལྷ་ས། · བུད་མེད།', region: 'ལྷ་ས།' },
  { key: 'lhasa_male', label: 'ལྷ་ས། · སྐྱེས་པ།', region: 'ལྷ་ས།' },
  { key: 'amdo_female', label: 'ཨ་མདོ། · བུད་མེད།', region: 'ཨ་མདོ།' },
  { key: 'amdo_male', label: 'ཨ་མདོ། · སྐྱེས་པ།', region: 'ཨ་མདོ།' },
  { key: 'kham_female', label: 'ཁམས། · བུད་མེད།', region: 'ཁམས།' },
  { key: 'kham_male', label: 'ཁམས། · སྐྱེས་པ།', region: 'ཁམས།' },
]

/**
 * Decoupled spoken fillers — NOT produced by Melong.
 * Prefetched via TTS for the selected voice so they play at near-zero latency
 * the moment STT finalizes (masks Melong wait).
 */
export const FILLER_BANK = [
  'ཨེ།',
  'འོང་།',
  'ཨང་།',
  'ཡིན་ན།',
  'ཏོག་ཙམ་སྒུག་རོགས།',
  'ངས་བསམ་བློ་ཐེངས་གཅིག་བཏང་ན།',
]

const STORAGE_KEY = 'mr_voice'
const CACHE = new Map()
const CACHE_MAX = 80
/** Skip starting a filler if the previous Melong wait was this fast (ms). */
export const FILLER_SKIP_IF_FASTER_MS = 400

function putCache(key, url) {
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value
    if (first != null) CACHE.delete(first)
  }
  CACHE.set(key, url)
}

async function fetchTtsUrl(text, voiceName) {
  const cacheKey = `${voiceName}::${text}`
  let url = CACHE.get(cacheKey)
  if (url) return url
  const data = await api.tutorTts(text, voiceName)
  url = data.audio_url
  if (url) putCache(cacheKey, url)
  return url
}

function stopEl(ref) {
  if (!ref.current) return
  try {
    ref.current.pause()
    ref.current.currentTime = 0
  } catch {
    /* ignore */
  }
  ref.current = null
}

async function fadeVolume(audio, to, ms = 140) {
  if (!audio) return
  const from = audio.volume
  const steps = 8
  const stepMs = Math.max(12, Math.floor(ms / steps))
  for (let i = 1; i <= steps; i++) {
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)))
    await new Promise((r) => window.setTimeout(r, stepMs))
  }
}

function playUrl(audioRef, url, { volume = 1, settleRef } = {}) {
  return new Promise((resolve, reject) => {
    const a = new Audio(url)
    a.volume = volume
    audioRef.current = a
    const settle = (ok) => {
      if (settleRef && settleRef.current === settle) settleRef.current = null
      if (audioRef.current === a) audioRef.current = null
      resolve(ok)
    }
    if (settleRef) settleRef.current = settle
    a.onended = () => settle(true)
    a.onerror = () => {
      if (settleRef && settleRef.current === settle) settleRef.current = null
      if (audioRef.current === a) audioRef.current = null
      reject(new Error('Playback failed'))
    }
    a.play().catch(reject)
  })
}

export function useTibetanVoice() {
  const [voice, setVoice] = useState(() => localStorage.getItem(STORAGE_KEY) || 'lhasa_female')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)
  const fillerRef = useRef(null)
  const speakSettleRef = useRef(null)
  const voiceRef = useRef(voice)
  const lastFillerRef = useRef('')
  const lastWaitMsRef = useRef(1200)

  useEffect(() => {
    voiceRef.current = voice
    localStorage.setItem(STORAGE_KEY, voice)
  }, [voice])

  /** Prefetch filler clips for the selected voice (Option B bank, same persona). */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const phrase of FILLER_BANK) {
        if (cancelled) return
        try {
          await fetchTtsUrl(phrase, voice)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [voice])

  const stop = useCallback(() => {
    const settle = speakSettleRef.current
    stopEl(audioRef)
    if (settle) {
      speakSettleRef.current = null
      settle(false) // interrupted
    }
  }, [])

  useEffect(() => () => {
    stop()
    stopEl(fillerRef)
  }, [stop])

  const stopFiller = useCallback(async ({ fade = false } = {}) => {
    const a = fillerRef.current
    if (!a) return
    if (fade) {
      try {
        await fadeVolume(a, 0, 130)
      } catch {
        /* ignore */
      }
    }
    stopEl(fillerRef)
  }, [])

  /**
   * Play one prefetched filler immediately (selected voice only).
   * Fire-and-forget friendly — does not wait for Melong.
   */
  const playFiller = useCallback(async ({ force = false } = {}) => {
    const voiceName = voiceRef.current
    if (!force && lastWaitMsRef.current < FILLER_SKIP_IF_FASTER_MS) {
      return false
    }
    const short = FILLER_BANK.slice(0, 3)
    const longer = FILLER_BANK.slice(3)
    const preferLong = lastWaitMsRef.current > 1500
    const preferred = preferLong ? longer : short
    const pool = preferred.filter((p) => p !== lastFillerRef.current)
    const fallback = FILLER_BANK.filter((p) => p !== lastFillerRef.current)
    const list = pool.length ? pool : fallback
    const pick = list[Math.floor(Math.random() * list.length)] || FILLER_BANK[0]
    lastFillerRef.current = pick
    try {
      const url = await fetchTtsUrl(pick, voiceName)
      if (!url) return false
      stopEl(fillerRef)
      playUrl(fillerRef, url, { volume: 1 }).catch(() => {})
      return true
    } catch {
      return false
    }
  }, [])

  /** Speak reply on selected voice; crossfade out any active filler first. */
  const speak = useCallback(
    async (text, { crossfadeFiller = true } = {}) => {
      if (!text) return false
      setError('')
      setLoading(true)
      stop()
      const voiceName = voiceRef.current
      try {
        const url = await fetchTtsUrl(text, voiceName)
        if (!url) throw new Error('No audio returned')
        if (crossfadeFiller && fillerRef.current) {
          await stopFiller({ fade: true })
        } else {
          await stopFiller({ fade: false })
        }
        return await playUrl(audioRef, url, { volume: 1, settleRef: speakSettleRef })
      } catch {
        setError('Voice unavailable')
        await stopFiller({ fade: false })
        return false
      } finally {
        setLoading(false)
      }
    },
    [stop, stopFiller],
  )

  const noteWaitMs = useCallback((ms) => {
    lastWaitMsRef.current = ms
  }, [])

  return {
    voice,
    setVoice,
    speak,
    stop,
    playFiller,
    stopFiller,
    noteWaitMs,
    loading,
    error,
  }
}

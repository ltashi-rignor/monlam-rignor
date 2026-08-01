/**
 * Vocab Rain — multi-mode falling-word game.
 * Monlam typing: falling Tibetan and keyboard input must be identical.
 * Meaning mode: falling Tibetan, type English.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { playFanfare, playLose, playWin, unlockAudio } from '../lib/gameSfx'
import { localVocabPack } from '../lib/vocabRainFallback'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePicker from '../components/VoicePicker'
import { bo } from '../i18n/bo'

const THEMES = [
  { id: 'all', labelKey: 'partyThemeAll', glyph: 'ཨ' },
  { id: 'animals', labelKey: 'partyThemeAnimals', glyph: 'ཁྱི' },
  { id: 'family', labelKey: 'partyThemeFamily', glyph: 'ཨ་མ' },
  { id: 'nature', labelKey: 'partyThemeNature', glyph: 'ཉི་མ' },
  { id: 'food', labelKey: 'partyThemeFood', glyph: 'ཇ' },
  { id: 'greetings', labelKey: 'partyThemeGreetings', glyph: 'བཀྲ་ཤིས་བདེ་ལེགས།' },
  { id: 'numbers', labelKey: 'partyThemeNumbers', glyph: 'གསུམ' },
]

const GAME_MODES = [
  {
    id: 'meaning',
    titleKey: 'partyModeMeaning',
    subKey: 'partyModeMeaningSub',
    glyph: 'A',
  },
  {
    id: 'monlam',
    titleKey: 'partyModeMonlam',
    subKey: 'partyModeMonlamSub',
    glyph: 'ཀ',
  },
]

const BALLOON_COLORS = ['#1a6b76', '#c47a16', '#2a9d8f', '#e9c46a', '#f4a261', '#0d3d45']
const START_SPEED = 7.5
const SPEED_STEP = 0.55
const MAX_SPEED = 22
const FLOOR = 88
const PACK_SIZE = 28
const REFILL_AT = 6

function normalizeEn(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalize Tibetan for identical compare (Monlam typing). */
function normalizeBo(s) {
  return String(s || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[་།\s]/g, '')
    .trim()
}

function englishAnswers(word) {
  // Always merge english / wylie / answers — never rely on answers alone
  // (Melong sometimes returns incomplete or non-Latin answers arrays).
  const bag = []
  if (Array.isArray(word?.answers)) bag.push(...word.answers)
  if (word?.english) {
    bag.push(word.english)
    for (const part of String(word.english).split(/[/|,;]/)) bag.push(part)
  }
  if (word?.wylie) bag.push(word.wylie)
  return [...new Set(bag.map(normalizeEn).filter(Boolean))]
}

function tibetanAnswers(word) {
  const raw = [word?.tibetan, ...(Array.isArray(word?.tibetan_answers) ? word.tibetan_answers : [])]
  const out = []
  for (const item of raw) {
    if (!item) continue
    const n = normalizeBo(item)
    if (n) out.push(n)
    // Also accept with/without a single trailing syllable mark already stripped above
  }
  return [...new Set(out)]
}

function isMatch(typed, word, mode) {
  if (!word) return false
  if (mode === 'monlam') {
    const t = normalizeBo(typed)
    if (!t) return false
    return tibetanAnswers(word).includes(t)
  }
  const t = normalizeEn(typed)
  if (!t) return false
  const answers = englishAnswers(word)
  if (answers.includes(t)) return true
  // Allow typing one word from a multi-word gloss ("hello / blessings" → "hello")
  return answers.some((a) => a.split(' ').includes(t) && t.length >= 2)
}

function hasTypedContent(typed, mode) {
  return mode === 'monlam' ? Boolean(normalizeBo(typed)) : Boolean(normalizeEn(typed))
}

function pickWord(pool, usedIds, avoidId) {
  if (!pool?.length) return null
  const unused = pool.filter((w) => !usedIds.has(w.id) && w.id !== avoidId)
  const bag = unused.length ? unused : pool.filter((w) => w.id !== avoidId)
  const opts = bag.length ? bag : pool
  return opts[Math.floor(Math.random() * opts.length)]
}

function makeBalloons(n = 14) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    left: 6 + Math.random() * 88,
    delay: Math.random() * 0.35,
    dur: 1.6 + Math.random() * 1.1,
    size: 28 + Math.random() * 28,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    drift: (Math.random() - 0.5) * 80,
  }))
}

function makeConfetti(n = 28) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c-${Date.now()}-${i}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.1 + Math.random() * 0.9,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    rot: Math.random() * 360,
  }))
}

function bestKey(mode) {
  return `mr_vocab_rain_best_${mode || 'meaning'}`
}

export default function LetterParty() {
  const { voice, setVoice, speak } = useTibetanVoice()
  const [phase, setPhase] = useState('lobby') // lobby | loading | play | over
  const [mode, setMode] = useState('meaning')
  const [theme, setTheme] = useState('animals')
  const [pool, setPool] = useState([])
  const [source, setSource] = useState('ai')
  const [loadError, setLoadError] = useState('')
  const [word, setWord] = useState(null)
  const [y, setY] = useState(0)
  const [speed, setSpeed] = useState(START_SPEED)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem(bestKey('meaning')) || 0))
  const [input, setInput] = useState('')
  const [balloons, setBalloons] = useState([])
  const [confetti, setConfetti] = useState([])
  const [cheer, setCheer] = useState('')
  const [shake, setShake] = useState(false)

  const inputRef = useRef(null)
  const wordRef = useRef(null)
  const poolRef = useRef([])
  const usedRef = useRef(new Set())
  const refillBusyRef = useRef(false)
  const composingRef = useRef(false)
  const themeRef = useRef(theme)
  const modeRef = useRef(mode)
  const speedRef = useRef(START_SPEED)
  const yRef = useRef(0)
  const scoreRef = useRef(0)
  const phaseRef = useRef(phase)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    wordRef.current = word
  }, [word])
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  useEffect(() => {
    poolRef.current = pool
  }, [pool])
  useEffect(() => {
    themeRef.current = theme
  }, [theme])
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const clearFx = useCallback(() => {
    setBalloons([])
    setConfetti([])
    setCheer('')
  }, [])

  const celebrate = useCallback(
    (big = false) => {
      setBalloons(makeBalloons(big ? 20 : 12))
      setConfetti(makeConfetti(big ? 36 : 22))
      setCheer(big ? bo.modules.partyCheerBig : bo.modules.partyCheer)
      if (big) playFanfare()
      else playWin()
      window.setTimeout(clearFx, big ? 2600 : 1800)
    },
    [clearFx],
  )

  const gameOver = useCallback(() => {
    if (phaseRef.current !== 'play') return
    phaseRef.current = 'over'
    setPhase('over')
    playLose()
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
    setBest((b) => {
      const next = Math.max(b, scoreRef.current)
      localStorage.setItem(bestKey(modeRef.current), String(next))
      return next
    })
  }, [])

  const refillPool = useCallback(async () => {
    if (refillBusyRef.current || phaseRef.current !== 'play') return
    const unused = poolRef.current.filter((w) => !usedRef.current.has(w.id)).length
    if (unused > REFILL_AT) return
    refillBusyRef.current = true
    try {
      const exclude = poolRef.current.map((w) => w.tibetan).slice(-40)
      let pack
      try {
        pack = await api.generateVocabRain(themeRef.current, PACK_SIZE, 'easy', exclude)
      } catch {
        pack = localVocabPack(themeRef.current, PACK_SIZE, exclude)
      }
      const incoming = Array.isArray(pack.words) ? pack.words : []
      if (!incoming.length) return
      const have = new Set(poolRef.current.map((w) => w.tibetan))
      const merged = [...poolRef.current]
      for (const w of incoming) {
        if (have.has(w.tibetan)) continue
        have.add(w.tibetan)
        merged.push(w)
      }
      poolRef.current = merged
      setPool(merged)
      if (pack.source === 'ai') setSource('ai')
      else if (pack.source === 'fallback') setSource('fallback')
    } catch {
      /* keep current pool */
    } finally {
      refillBusyRef.current = false
    }
  }, [])

  const spawn = useCallback(
    (avoidId, nextSpeed) => {
      const w = pickWord(poolRef.current, usedRef.current, avoidId)
      if (!w) {
        gameOver()
        return
      }
      usedRef.current.add(w.id)
      setWord(w)
      wordRef.current = w
      setY(0)
      yRef.current = 0
      setInput('')
      if (typeof nextSpeed === 'number') {
        setSpeed(nextSpeed)
        speedRef.current = nextSpeed
      }
      speak(w.tibetan)
      window.setTimeout(() => inputRef.current?.focus(), 40)
      refillPool()
    },
    [speak, gameOver, refillPool],
  )

  const beginPlay = useCallback(
    (words, themeId, packSource, playMode) => {
      setPool(words)
      poolRef.current = words
      usedRef.current = new Set()
      setSource(packSource || 'ai')
      setTheme(themeId)
      themeRef.current = themeId
      setMode(playMode)
      modeRef.current = playMode
      scoreRef.current = 0
      setScore(0)
      setBest(Number(localStorage.getItem(bestKey(playMode)) || 0))
      setInput('')
      setShake(false)
      clearFx()
      const s = START_SPEED
      setSpeed(s)
      speedRef.current = s
      phaseRef.current = 'play'
      setPhase('play')
      spawn(null, s)
    },
    [clearFx, spawn],
  )

  const start = async (themeId, playMode = mode) => {
    unlockAudio()
    setLoadError('')
    setTheme(themeId)
    setMode(playMode)
    modeRef.current = playMode
    phaseRef.current = 'loading'
    setPhase('loading')
    try {
      let pack
      try {
        pack = await api.generateVocabRain(themeId, PACK_SIZE, 'easy', [])
      } catch {
        pack = localVocabPack(themeId, PACK_SIZE, [])
      }
      const words = Array.isArray(pack.words) ? pack.words : []
      const finalPack =
        words.length >= 8 ? pack : localVocabPack(themeId, PACK_SIZE, [])
      const finalWords = Array.isArray(finalPack.words) ? finalPack.words : []
      if (!finalWords.length) throw new Error(bo.modules.partyLoadEmpty)
      beginPlay(finalWords, themeId, finalPack.source || 'fallback', playMode)
    } catch (err) {
      // Absolute last resort — should almost never hit
      const pack = localVocabPack(themeId, PACK_SIZE, [])
      if (pack.words?.length) {
        beginPlay(pack.words, themeId, 'fallback', playMode)
      } else {
        setLoadError(err.message || bo.modules.partyLoadFail)
        phaseRef.current = 'lobby'
        setPhase('lobby')
      }
    }
  }

  useEffect(() => {
    if (phase !== 'play') {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
      return undefined
    }
    const tick = (ts) => {
      if (phaseRef.current !== 'play') return
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts
      const ny = yRef.current + speedRef.current * dt
      yRef.current = ny
      setY(ny)
      if (ny >= FLOOR) {
        gameOver()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, gameOver])

  const tryMatch = useCallback((raw) => {
    if (phaseRef.current !== 'play' || !wordRef.current) return false
    if (!isMatch(raw, wordRef.current, modeRef.current)) return false

    const nextScore = scoreRef.current + 1
    scoreRef.current = nextScore
    setScore(nextScore)
    celebrate(nextScore > 0 && nextScore % 5 === 0)
    const nextSpeed = Math.min(MAX_SPEED, speedRef.current + SPEED_STEP)
    spawn(wordRef.current.id, nextSpeed)
    return true
  }, [celebrate, spawn])

  const commitTyped = useCallback(() => {
    if (phaseRef.current !== 'play') return
    unlockAudio()
    composingRef.current = false
    const raw = inputRef.current?.value ?? ''
    setInput(raw)
    if (!hasTypedContent(raw, modeRef.current)) return
    if (tryMatch(raw)) return
    gameOver()
  }, [tryMatch, gameOver])

  /** Flush IME → then judge. Monlam needs a short delay so the glyph is in the DOM. */
  const flushAndCommit = useCallback(
    (delayMs = 0) => {
      window.setTimeout(() => {
        if (phaseRef.current !== 'play') return
        const raw = inputRef.current?.value ?? ''
        setInput(raw)
        // Still empty after Monlam confirm — wait once more for compositionend
        if (modeRef.current === 'monlam' && !hasTypedContent(raw, 'monlam')) {
          window.setTimeout(() => commitTyped(), 80)
          return
        }
        commitTyped()
      }, delayMs)
    },
    [commitTyped],
  )

  const onCompositionStart = () => {
    composingRef.current = true
  }

  const onCompositionEnd = (e) => {
    composingRef.current = false
    const v = e.target.value
    setInput(v)
    // Auto-clear when the finished glyph(s) already match the falling word
    window.setTimeout(() => {
      tryMatch(inputRef.current?.value ?? v)
    }, 0)
  }

  const onInput = (e) => {
    const v = e.target.value
    setInput(v)
    if (composingRef.current || e.nativeEvent?.isComposing) return
    tryMatch(v)
  }

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return

    // Monlam: first Enter often finishes the IME syllable — don't judge yet.
    // (Avoid keyCode 229 alone; some browsers keep it set and block all Enter.)
    if (modeRef.current === 'monlam' && (e.nativeEvent.isComposing || composingRef.current)) {
      return
    }

    // Meaning mode, or Monlam after the glyph is committed: submit / judge
    e.preventDefault()
    flushAndCommit(modeRef.current === 'monlam' ? 50 : 0)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    // Clicking འགྲོ། / Enter that bubbled as submit
    if (modeRef.current === 'monlam' && composingRef.current) return
    flushAndCommit(modeRef.current === 'monlam' ? 40 : 0)
  }

  const themeLabel = (id) => {
    const t = THEMES.find((x) => x.id === id)
    return t ? bo.modules[t.labelKey] : id
  }

  const modeLabel = (id) => {
    const m = GAME_MODES.find((x) => x.id === id)
    return m ? bo.modules[m.titleKey] : id
  }

  const fallingText = word?.tibetan || ''
  const overAnswer =
    mode === 'monlam' ? word?.tibetan : englishAnswers(word || {})[0] || word?.english

  const typeHint = mode === 'monlam' ? bo.modules.partyTypeHintBo : bo.modules.partyTypeHint
  const placeholder = mode === 'monlam' ? 'ཁྱི' : 'water, dog, mother…'

  return (
    <div
      className={
        'module-page tibetan rain-page' +
        (phase === 'play' || phase === 'over' ? ' is-arena' : ' is-lobby')
      }
    >
      <div className="party-fx" aria-hidden>
        {balloons.map((b) => (
          <span
            key={b.id}
            className="party-balloon"
            style={{
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 1.25,
              background: b.color,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
              '--drift': `${b.drift}px`,
            }}
          />
        ))}
        {confetti.map((c) => (
          <span
            key={c.id}
            className="party-confetti"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>

      {cheer && <p className="party-cheer">{cheer}</p>}

      {(phase === 'lobby' || phase === 'loading') && (
        <section className="rain-lobby">
          <div className="rain-lobby-hero">
            <p className="rain-brand">{bo.brand}</p>
            <h1 className="rain-title">{bo.modules.partyTitle}</h1>
            <p className="rain-tagline">{bo.modules.partySub}</p>
            <div className="rain-lobby-sky" aria-hidden>
              <span className="rain-drift rain-drift-a">ཆུ</span>
              <span className="rain-drift rain-drift-b">ཉི་མ</span>
              <span className="rain-drift rain-drift-c">ཁྱི</span>
            </div>
          </div>

          <div className="rain-lobby-body">
            <div className="rain-lobby-tools">
              <p className="rain-pick">{bo.modules.partyPickMode}</p>
              <VoicePicker value={voice} onChange={setVoice} />
            </div>
            <p className="rain-how">{bo.modules.partyAiNote}</p>

            <div className="rain-mode-row">
              {GAME_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={'rain-mode-btn' + (mode === m.id ? ' is-active' : '')}
                  onClick={() => setMode(m.id)}
                >
                  <span className={'rain-mode-glyph' + (m.id === 'monlam' ? ' tibetan' : '')}>
                    {m.glyph}
                  </span>
                  <strong>{bo.modules[m.titleKey]}</strong>
                  <span>{bo.modules[m.subKey]}</span>
                </button>
              ))}
            </div>

            <p className="rain-pick rain-pick-theme">{bo.modules.partyPickLevel}</p>
            {loadError && <p className="error">{loadError}</p>}

            {phase === 'loading' ? (
              <div className="rain-loading-block">
                <span className="rain-loading-orb" aria-hidden />
                <p className="rain-loading">{bo.modules.partyLoading}</p>
              </div>
            ) : (
              <div className="rain-theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="rain-theme-btn"
                    onClick={() => start(t.id, mode)}
                  >
                    <span className="rain-theme-glyph tibetan">{t.glyph}</span>
                    <strong>{bo.modules[t.labelKey]}</strong>
                    <span className="rain-theme-meta">{bo.modules.partyAiPack}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(phase === 'play' || phase === 'over') && (
        <section className={'rain-stage' + (shake ? ' is-shake' : '')}>
          <header className="rain-arena-top">
            <button
              type="button"
              className="rain-back"
              onClick={() => {
                phaseRef.current = 'lobby'
                setPhase('lobby')
              }}
            >
              {bo.modules.partyChangeLevel}
            </button>
            <div className="rain-scoreboard">
              <div className="rain-stat">
                <span>{bo.modules.partyScore}</span>
                <b dir="ltr">{score}</b>
              </div>
              <div className="rain-stat">
                <span>{bo.modules.partyBest}</span>
                <b dir="ltr">{best}</b>
              </div>
            </div>
            <div className="rain-arena-meta">
              <span>{modeLabel(mode)}</span>
              <span>{themeLabel(theme)}</span>
              <span dir="ltr">
                {source === 'ai' ? bo.modules.partySourceAi : bo.modules.partySourceFallback}
              </span>
            </div>
          </header>

          <div className="rain-sky" aria-live="polite">
            <div className="rain-sky-wash" aria-hidden />
            <div className="rain-cloud rain-cloud-1" aria-hidden />
            <div className="rain-cloud rain-cloud-2" aria-hidden />
            <div className="rain-ridge" aria-hidden />
            <div className="rain-floor-line" aria-hidden />

            {word && phase === 'play' && (
              <button
                key={word.id}
                type="button"
                className="rain-falling tibetan"
                style={{ top: `${y}%`, left: '50%' }}
                onClick={() => speak(word.tibetan)}
                aria-label={bo.modules.listen}
              >
                {fallingText}
              </button>
            )}

            {phase === 'over' && word && (
              <div className="rain-over">
                <p className="rain-over-kicker">{bo.modules.partyOverTitle}</p>
                <p className="rain-over-word tibetan">{word.tibetan}</p>
                <p className={'rain-over-answer' + (mode === 'monlam' ? ' tibetan' : '')}>
                  {bo.modules.partyOverAnswer}: {overAnswer}
                </p>
                <p className="rain-over-score" dir="ltr">
                  {score}
                </p>
                <div className="rain-over-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => start(theme, mode)}
                  >
                    {bo.modules.partyPlayAgain}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      phaseRef.current = 'lobby'
                      setPhase('lobby')
                    }}
                  >
                    {bo.modules.partyChangeLevel}
                  </button>
                </div>
              </div>
            )}
          </div>

          {phase === 'play' && (
            <form className="rain-typebar" onSubmit={onSubmit}>
              <label className="rain-type-label" htmlFor="rain-input">
                {typeHint}
              </label>
              <div className="rain-type-row">
                <input
                  id="rain-input"
                  ref={inputRef}
                  className={'rain-input' + (mode === 'monlam' ? ' is-bo' : ' is-en')}
                  lang={mode === 'monlam' ? 'bo' : 'en'}
                  inputMode={mode === 'monlam' ? 'text' : 'latin'}
                  enterKeyHint="done"
                  dir={mode === 'monlam' ? 'auto' : 'ltr'}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  // Meaning mode: default Latin keyboard. Monlam mode: use Monlam IME.
                  value={input}
                  onChange={onInput}
                  onKeyDown={onKeyDown}
                  onCompositionStart={mode === 'monlam' ? onCompositionStart : undefined}
                  onCompositionEnd={mode === 'monlam' ? onCompositionEnd : undefined}
                  placeholder={placeholder}
                />
                <button type="submit" className="btn btn-primary rain-go">
                  {bo.modules.partyGo}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

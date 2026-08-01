import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  VOCAB_THEMES,
  isThemeUnlocked,
  themeProgress,
  themeWords,
  unlockedWords,
} from '../data/flashJourney'
import VoicePicker from '../components/VoicePicker'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import { playLose, playWin, unlockAudio } from '../lib/gameSfx'
import { useI18n } from '../i18n/useI18n'

const RITUAL = ['see', 'hear', 'meaning']

function pickHearMatch(pool) {
  const list = pool.length ? pool : themeWords(VOCAB_THEMES[0])
  const target = list[Math.floor(Math.random() * list.length)]
  const decoys = list
    .filter((w) => w.id !== target.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
  const options = [target, ...decoys].sort(() => Math.random() - 0.5)
  while (options.length < 4) {
    const extra = unlockedWords([]).find((w) => !options.some((o) => o.id === w.id))
    if (!extra) break
    options.push(extra)
  }
  return { target, options: options.slice(0, 6) }
}

export default function Flashcards() {
  const { t } = useI18n()

  const { progress, markItem } = useModuleProgress()
  const mastered = progress.mastered_words || []
  const { voice, setVoice, speak, loading: audioLoading } = useTibetanVoice()

  const [activeTheme, setActiveTheme] = useState(0)
  const [ritualWord, setRitualWord] = useState(null)
  const [step, setStep] = useState('see')
  const [heard, setHeard] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [findRound, setFindRound] = useState(null)
  const [findLocked, setFindLocked] = useState(false)
  const [findMsg, setFindMsg] = useState('')

  const unlockedPool = useMemo(() => unlockedWords(mastered), [mastered])

  const currentTheme = VOCAB_THEMES[activeTheme] || VOCAB_THEMES[0]
  const words = themeWords(currentTheme)
  const progressInfo = themeProgress(currentTheme, mastered)

  const openRitual = useCallback((word) => {
    unlockAudio()
    setRitualWord(word)
    setStep('see')
    setHeard(false)
    setFlipped(false)
  }, [])

  const closeRitual = () => {
    setRitualWord(null)
    setStep('see')
    setFlipped(false)
  }

  async function finishRitual() {
    if (!ritualWord) return
    if (!mastered.includes(ritualWord.id)) {
      try {
        await markItem('word', ritualWord.id, 5)
      } catch {
        /* ignore */
      }
    }
    playWin()
    closeRitual()
  }

  function startHearMatch() {
    unlockAudio()
    const round = pickHearMatch(unlockedPool)
    setFindRound(round)
    setFindLocked(false)
    setFindMsg('')
    speak(round.target.tibetan)
  }

  function onFindPick(word) {
    if (!findRound || findLocked) return
    setFindLocked(true)
    if (word.id === findRound.target.id) {
      playWin()
      setFindMsg(t.modules.flashFindCorrect)
      if (!mastered.includes(word.id)) {
        markItem('word', word.id, 3).catch(() => {})
      }
    } else {
      playLose()
      setFindMsg(t.modules.flashFindWrong)
    }
  }

  useEffect(() => {
    const idx = VOCAB_THEMES.findIndex((theme, i) => {
      if (!isThemeUnlocked(i, mastered)) return false
      return !themeProgress(theme, mastered).complete
    })
    if (idx >= 0) setActiveTheme(idx)
  }, [mastered])

  if (!words.length && !ritualWord) {
    return <div className="empty panel">{t.modules.emptyDeck}</div>
  }

  return (
    <div className="module-page tibetan flash-journey-page">
      <header className="page-header flash-hero">
        <div>
          <p className="module-eyebrow">{t.modules.flashEyebrow}</p>
          <h1>{t.modules.flashTitle}</h1>
          <p>{t.modules.flashJourneySub}</p>
        </div>
        <div className="flash-hero-actions">
          <VoicePicker value={voice} onChange={setVoice} />
          <button type="button" className="btn btn-accent" onClick={startHearMatch}>
            {t.modules.flashHearMatch}
          </button>
        </div>
      </header>

      <div className="flash-journey-track" role="list">
        {VOCAB_THEMES.map((theme, i) => {
          const unlocked = isThemeUnlocked(i, mastered)
          const prog = themeProgress(theme, mastered)
          const isActive = i === activeTheme
          return (
            <button
              key={theme.id}
              type="button"
              role="listitem"
              className={`flash-theme-card ${unlocked ? 'is-open' : 'is-locked'} ${
                isActive ? 'is-active' : ''
              } ${prog.complete ? 'is-complete' : ''}`}
              onClick={() => unlocked && setActiveTheme(i)}
              disabled={!unlocked}
            >
              <span className="flash-theme-index" dir="ltr">
                {i + 1}
              </span>
              <span className="flash-theme-body">
                <span className="flash-theme-label">{theme.label}</span>
                <span className="flash-theme-meta" dir="ltr">
                  {unlocked ? `${prog.done}/${prog.total}` : t.modules.flashLocked}
                </span>
              </span>
              {prog.complete && <span className="flash-theme-check">✓</span>}
            </button>
          )
        })}
      </div>

      <section className="panel flash-theme-stage">
        <div className="flash-theme-stage-head">
          <h2>{currentTheme.label}</h2>
          <p className="muted">
            {t.modules.flashThemeHint} · {progressInfo.done}/{progressInfo.total}
          </p>
        </div>
        <div className="flash-word-grid">
          {words.map((w, i) => {
            const done = mastered.includes(w.id)
            return (
              <button
                key={w.id}
                type="button"
                className={`flash-word-pill ${done ? 'is-mastered' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => openRitual(w)}
              >
                <span className="tibetan flash-word-glyph">{w.tibetan}</span>
                <span className="flash-word-en" dir="ltr">
                  {w.english}
                </span>
                {done && <span className="flash-word-done">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      {ritualWord && (
        <div className="modal-backdrop flash-ritual-backdrop" onClick={closeRitual} role="presentation">
          <div
            className="modal-card panel flash-ritual"
            data-step={step}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t.modules.flashRitualTitle}
          >
            <button type="button" className="modal-close btn btn-ghost" onClick={closeRitual}>
              ✕
            </button>

            <div className="flash-ritual-steps" aria-hidden>
              {RITUAL.map((s) => {
                const si = RITUAL.indexOf(s)
                const cur = RITUAL.indexOf(step)
                return (
                  <span
                    key={s}
                    className={`flash-ritual-dot ${si === cur ? 'is-now' : ''} ${si < cur ? 'is-done' : ''}`}
                  />
                )
              })}
            </div>

            <p className="module-eyebrow">{t.modules.flashRitualTitle}</p>
            <div className="flash-ritual-theme muted">
              {VOCAB_THEMES.find((theme) => theme.key === ritualWord.theme)?.label || currentTheme.label}
            </div>

            {step === 'see' && (
              <div className="flash-ritual-panel">
                <div key={ritualWord.id} className="flash-ritual-glyph tibetan">
                  {ritualWord.tibetan}
                </div>
                <p className="muted">{t.modules.flashStepSee}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    unlockAudio()
                    setStep('hear')
                  }}
                >
                  {t.modules.flashNextHear}
                </button>
              </div>
            )}

            {step === 'hear' && (
              <div className="flash-ritual-panel">
                <div className="flash-ritual-glyph tibetan">{ritualWord.tibetan}</div>
                <p className="muted">{t.modules.flashStepHear}</p>
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={audioLoading}
                  onClick={() => {
                    unlockAudio()
                    speak(ritualWord.tibetan)
                    setHeard(true)
                  }}
                >
                  {audioLoading ? '…' : t.modules.listen}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!heard}
                  onClick={() => {
                    setFlipped(false)
                    setStep('meaning')
                  }}
                >
                  {t.modules.flashNextMeaning}
                </button>
              </div>
            )}

            {step === 'meaning' && (
              <div className="flash-ritual-panel">
                <p className="muted">{t.modules.flashStepMeaning}</p>
                <div className="perspective flash-ritual-stage">
                  <div
                    className={`flip-card ${flipped ? 'is-flipped' : ''}`}
                    onClick={() => setFlipped((f) => !f)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setFlipped((f) => !f)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flip-face flip-front panel">
                      <div className="muted">{t.modules.tapFlip}</div>
                      <div className="flash-tibetan tibetan">{ritualWord.tibetan}</div>
                    </div>
                    <div className="flip-face flip-back">
                      <div className="flash-back-label">{t.modules.meaning}</div>
                      <div className="flash-english" dir="ltr">
                        {ritualWord.english}
                      </div>
                      <div className="flash-wylie" dir="ltr">
                        {ritualWord.wylie}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={audioLoading}
                  onClick={() => {
                    unlockAudio()
                    speak(ritualWord.tibetan)
                  }}
                >
                  {t.modules.listen}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!flipped}
                  onClick={finishRitual}
                >
                  {t.modules.flashFinishWord}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {findRound && (
        <div
          className="modal-backdrop"
          onClick={() => setFindRound(null)}
          role="presentation"
        >
          <div
            className="modal-card panel flash-find"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <button
              type="button"
              className="modal-close btn btn-ghost"
              onClick={() => setFindRound(null)}
            >
              ✕
            </button>
            <h2 style={{ marginTop: 0 }}>{t.modules.flashHearMatch}</h2>
            <p className="muted">{t.modules.flashHearMatchHint}</p>
            <button
              type="button"
              className="btn btn-accent"
              disabled={audioLoading}
              onClick={() => speak(findRound.target.tibetan)}
            >
              {t.modules.listen}
            </button>
            <div className="flash-find-options">
              {findRound.options.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="flash-word-pill flash-find-pill"
                  disabled={findLocked}
                  onClick={() => onFindPick(w)}
                >
                  <span className="tibetan flash-word-glyph">{w.tibetan}</span>
                </button>
              ))}
            </div>
            {findMsg && <p className="flash-find-msg">{findMsg}</p>}
            {findLocked && (
              <button type="button" className="btn btn-primary" onClick={startHearMatch}>
                {t.modules.flashFindAgain}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

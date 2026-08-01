import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { VOWELS } from '../data/tibetan'
import {
  CONSONANT_ROWS,
  consonantByGlyph,
  exampleFor,
  isRowUnlocked,
  rowLetters,
  rowProgress,
} from '../data/alphabetJourney'
import LetterMiniTrace from '../components/LetterMiniTrace'
import VoicePicker from '../components/VoicePicker'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import { playLose, playWin, unlockAudio } from '../lib/gameSfx'
import { bo } from '../i18n/bo'

const RITUAL = ['see', 'hear', 'trace', 'word']

function pickHearFind(mastered, unlockedGlyphs) {
  const pool = unlockedGlyphs.length ? unlockedGlyphs : CONSONANT_ROWS[0].letters
  const target = pool[Math.floor(Math.random() * pool.length)]
  const decoys = pool.filter((g) => g !== target).sort(() => Math.random() - 0.5).slice(0, 5)
  const options = [target, ...decoys].sort(() => Math.random() - 0.5)
  while (options.length < 4) {
    const extra = CONSONANT_ROWS.flatMap((r) => r.letters).find((g) => !options.includes(g))
    if (!extra) break
    options.push(extra)
  }
  return { target, options: options.slice(0, 6), mastered }
}

export default function Alphabet() {
  const { progress, markItem } = useModuleProgress()
  const mastered = progress.mastered_letters || []
  const { voice, setVoice, speak, loading: audioLoading } = useTibetanVoice()

  const [activeRow, setActiveRow] = useState(0)
  const [ritualLetter, setRitualLetter] = useState(null)
  const [step, setStep] = useState('see')
  const [heard, setHeard] = useState(false)
  const [traced, setTraced] = useState(false)
  const [wordHeard, setWordHeard] = useState(false)
  const [findRound, setFindRound] = useState(null)
  const [findLocked, setFindLocked] = useState(false)
  const [findMsg, setFindMsg] = useState('')

  const unlockedGlyphs = useMemo(() => {
    const out = []
    CONSONANT_ROWS.forEach((row, i) => {
      if (isRowUnlocked(i, mastered)) out.push(...row.letters)
    })
    return out
  }, [mastered])

  const currentRow = CONSONANT_ROWS[activeRow] || CONSONANT_ROWS[0]
  const letters = rowLetters(currentRow)
  const progressInfo = rowProgress(currentRow, mastered)
  const example = ritualLetter ? exampleFor(ritualLetter.letter) : null

  const openRitual = useCallback((consonant) => {
    unlockAudio()
    setRitualLetter(consonant)
    setStep('see')
    setHeard(false)
    setTraced(false)
    setWordHeard(false)
  }, [])

  const closeRitual = () => {
    setRitualLetter(null)
    setStep('see')
  }

  async function finishRitual() {
    if (!ritualLetter) return
    if (!mastered.includes(ritualLetter.id)) {
      try {
        await markItem('letter', ritualLetter.id, 5)
      } catch {
        /* ignore */
      }
    }
    playWin()
    closeRitual()
  }

  function startHearFind() {
    unlockAudio()
    const round = pickHearFind(mastered, unlockedGlyphs)
    setFindRound(round)
    setFindLocked(false)
    setFindMsg('')
    speak(round.target)
  }

  function onFindPick(glyph) {
    if (!findRound || findLocked) return
    setFindLocked(true)
    if (glyph === findRound.target) {
      playWin()
      setFindMsg(bo.modules.alphaFindCorrect)
      const c = consonantByGlyph(glyph)
      if (c && !mastered.includes(c.id)) {
        markItem('letter', c.id, 3).catch(() => {})
      }
    } else {
      playLose()
      setFindMsg(bo.modules.alphaFindWrong)
    }
  }

  useEffect(() => {
    const idx = CONSONANT_ROWS.findIndex((row, i) => {
      if (!isRowUnlocked(i, mastered)) return false
      return !rowProgress(row, mastered).complete
    })
    if (idx >= 0) setActiveRow(idx)
  }, [mastered])

  return (
    <div className="module-page tibetan alpha-journey-page">
      <header className="page-header alpha-hero">
        <div>
          <p className="module-eyebrow">{bo.modules.alphabetEyebrow}</p>
          <h1>{bo.modules.alphabetTitle}</h1>
          <p>{bo.modules.alphaJourneySub}</p>
        </div>
        <div className="alpha-hero-actions">
          <VoicePicker value={voice} onChange={setVoice} />
          <button type="button" className="btn btn-accent" onClick={startHearFind}>
            {bo.modules.alphaHearFind}
          </button>
        </div>
      </header>

      <div className="alpha-journey-track" role="list">
        {CONSONANT_ROWS.map((row, i) => {
          const unlocked = isRowUnlocked(i, mastered)
          const prog = rowProgress(row, mastered)
          const isActive = i === activeRow
          return (
            <button
              key={row.id}
              type="button"
              role="listitem"
              className={`alpha-row-card ${unlocked ? 'is-open' : 'is-locked'} ${isActive ? 'is-active' : ''} ${
                prog.complete ? 'is-complete' : ''
              }`}
              onClick={() => unlocked && setActiveRow(i)}
              disabled={!unlocked}
            >
              <span className="alpha-row-index" dir="ltr">
                {i + 1}
              </span>
              <span className="alpha-row-body">
                <span className="alpha-row-label">{row.label}</span>
                <span className="alpha-row-glyphs tibetan">
                  {row.letters.join(' ')}
                </span>
                <span className="alpha-row-meta" dir="ltr">
                  {unlocked
                    ? `${prog.done}/${prog.total}`
                    : bo.modules.alphaLocked}
                </span>
              </span>
              {prog.complete && <span className="alpha-row-check">✓</span>}
            </button>
          )
        })}
      </div>

      <section className="panel alpha-row-stage">
        <div className="alpha-row-stage-head">
          <h2>{currentRow.label}</h2>
          <p className="muted">
            {bo.modules.alphaRowHint} · {progressInfo.done}/{progressInfo.total}
          </p>
        </div>
        <div className="alpha-row-letters">
          {letters.map((c, i) => {
            const done = mastered.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`alpha-letter-pill ${done ? 'is-mastered' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => openRitual(c)}
              >
                <span className="tibetan alpha-letter-glyph">{c.letter}</span>
                <span className="alpha-letter-latin" dir="ltr">
                  {c.latin}
                </span>
                {done && <span className="alpha-letter-done">✓</span>}
              </button>
            )
          })}
        </div>
        <div className="alpha-row-links">
          <Link className="btn btn-ghost" to="/handwriting">
            {bo.modules.alphaGoHandwriting}
          </Link>
          <Link className="btn btn-ghost" to="/letter-party">
            {bo.modules.alphaGoParty}
          </Link>
        </div>
      </section>

      <section className="panel alpha-vowels-block">
        <h2 className="module-section-title" style={{ marginTop: 0 }}>
          {bo.modules.vowels}
        </h2>
        <div className="alpha-vowel-row">
          {VOWELS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="alpha-letter-pill"
              onClick={() => {
                unlockAudio()
                speak(v.letter)
              }}
            >
              <span className="tibetan alpha-letter-glyph">{v.letter}</span>
              <span className="alpha-letter-latin" dir="ltr">
                {v.latin}
              </span>
            </button>
          ))}
        </div>
      </section>

      {ritualLetter && (
        <div className="modal-backdrop alpha-ritual-backdrop" onClick={closeRitual} role="presentation">
          <div
            className="modal-card panel alpha-ritual"
            data-step={step}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={bo.modules.alphaRitualTitle}
          >
            <button type="button" className="modal-close btn btn-ghost" onClick={closeRitual}>
              ✕
            </button>

            <div className="alpha-ritual-steps" aria-hidden>
              {RITUAL.map((s) => {
                const si = RITUAL.indexOf(s)
                const cur = RITUAL.indexOf(step)
                return (
                  <span
                    key={s}
                    className={`alpha-ritual-dot ${si === cur ? 'is-now' : ''} ${si < cur ? 'is-done' : ''}`}
                  />
                )
              })}
            </div>

            <p className="module-eyebrow">{bo.modules.alphaRitualTitle}</p>
            <div key={ritualLetter.letter} className="alpha-ritual-glyph tibetan">
              {ritualLetter.letter}
            </div>
            <p className="alpha-ritual-latin" dir="ltr">
              {ritualLetter.latin} · {ritualLetter.wylie}
            </p>

            {step === 'see' && (
              <div className="alpha-ritual-panel">
                <p className="muted">{bo.modules.alphaStepSee}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    unlockAudio()
                    setStep('hear')
                  }}
                >
                  {bo.modules.alphaNextHear}
                </button>
              </div>
            )}

            {step === 'hear' && (
              <div className="alpha-ritual-panel">
                <p className="muted">{bo.modules.alphaStepHear}</p>
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={audioLoading}
                  onClick={() => {
                    unlockAudio()
                    speak(ritualLetter.letter)
                    setHeard(true)
                  }}
                >
                  {audioLoading ? '…' : bo.modules.listen}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!heard}
                  onClick={() => setStep('trace')}
                >
                  {bo.modules.alphaNextTrace}
                </button>
              </div>
            )}

            {step === 'trace' && (
              <div className="alpha-ritual-panel">
                <p className="muted">{bo.modules.alphaStepTrace}</p>
                <LetterMiniTrace
                  glyph={ritualLetter.letter}
                  onComplete={() => setTraced(true)}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!traced}
                  onClick={() => setStep('word')}
                >
                  {bo.modules.alphaNextWord}
                </button>
                {!traced && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setTraced(true)
                      setStep('word')
                    }}
                  >
                    {bo.modules.alphaSkipTrace}
                  </button>
                )}
              </div>
            )}

            {step === 'word' && (
              <div className="alpha-ritual-panel">
                <p className="muted">{bo.modules.alphaStepWord}</p>
                {example ? (
                  <div className="alpha-example-card">
                    <div className="tibetan alpha-example-word">{example.word}</div>
                    <div className="alpha-example-en" dir="ltr">
                      {example.meaning}
                    </div>
                    <div className="muted" dir="ltr">
                      {example.wylie}
                    </div>
                    <button
                      type="button"
                      className="btn btn-accent"
                      disabled={audioLoading}
                      onClick={() => {
                        unlockAudio()
                        speak(example.word)
                        setWordHeard(true)
                      }}
                    >
                      {bo.modules.alphaHearWord}
                    </button>
                  </div>
                ) : (
                  <p className="muted">—</p>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={example ? !wordHeard : false}
                  onClick={finishRitual}
                >
                  {bo.modules.alphaFinishLetter}
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
            className="modal-card panel alpha-find"
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
            <h2 style={{ marginTop: 0 }}>{bo.modules.alphaHearFind}</h2>
            <p className="muted">{bo.modules.alphaHearFindHint}</p>
            <button
              type="button"
              className="btn btn-accent"
              disabled={audioLoading}
              onClick={() => speak(findRound.target)}
            >
              {bo.modules.listen}
            </button>
            <div className="alpha-find-options">
              {findRound.options.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="alpha-letter-pill"
                  disabled={findLocked}
                  onClick={() => onFindPick(g)}
                >
                  <span className="tibetan alpha-letter-glyph">{g}</span>
                </button>
              ))}
            </div>
            {findMsg && <p className="alpha-find-msg">{findMsg}</p>}
            {findLocked && (
              <button type="button" className="btn btn-primary" onClick={startHearFind}>
                {bo.modules.alphaFindAgain}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

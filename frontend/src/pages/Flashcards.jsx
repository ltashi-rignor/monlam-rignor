import { useMemo, useState } from 'react'
import { VOCAB } from '../data/tibetan'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePicker from '../components/VoicePicker'
import { bo } from '../i18n/bo'

const THEMES = [
  { key: 'all', label: 'All' },
  { key: 'greetings', label: 'Greetings' },
  { key: 'family', label: 'Family' },
  { key: 'nature', label: 'Nature' },
  { key: 'animals', label: 'Animals' },
  { key: 'food', label: 'Food' },
  { key: 'pronouns', label: 'Pronouns' },
  { key: 'numbers', label: 'Numbers' },
]

export default function Flashcards() {
  const { progress, markItem } = useModuleProgress()
  const [theme, setTheme] = useState('all')
  const [flipped, setFlipped] = useState(false)
  const [idx, setIdx] = useState(0)
  const { voice, setVoice, speak, loading: audioLoading } = useTibetanVoice()

  const deck = useMemo(
    () => (theme === 'all' ? VOCAB : VOCAB.filter((w) => w.theme === theme)),
    [theme],
  )
  const card = deck[idx % Math.max(deck.length, 1)]
  const mastered = (progress.mastered_words || []).includes(card?.id)

  const next = () => {
    setFlipped(false)
    setIdx((i) => (i + 1) % deck.length)
  }
  const reset = () => {
    setFlipped(false)
    setIdx(0)
  }

  async function master() {
    try {
      if (card?.id) await markItem('word', card.id, 5)
    } catch {
      /* ignore */
    }
    next()
  }

  if (!card) return <div className="empty panel">{bo.modules.emptyDeck}</div>

  return (
    <div className="module-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{bo.modules.flashEyebrow}</p>
          <h1>{bo.modules.flashTitle}</h1>
          <p>{bo.modules.flashSub}</p>
        </div>
        <VoicePicker value={voice} onChange={setVoice} />
      </header>

      <div className="chip-row">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip-btn ${theme === t.key ? 'is-active' : ''}`}
            onClick={() => {
              setTheme(t.key)
              reset()
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="muted" dir="ltr">
        Card {(idx % deck.length) + 1} of {deck.length}
      </p>

      <div className="perspective flashcard-stage">
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
            <div className="muted">{bo.modules.tapFlip}</div>
            <div className="flash-tibetan tibetan">{card.tibetan}</div>
            <div className="flash-theme" dir="ltr">
              {card.theme}
            </div>
          </div>
          <div className="flip-face flip-back">
            <div className="flash-back-label">{bo.modules.meaning}</div>
            <div className="flash-english" dir="ltr">
              {card.english}
            </div>
            <div className="flash-wylie" dir="ltr">
              {card.wylie}
            </div>
          </div>
        </div>
      </div>

      <div className="module-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={audioLoading}
          onClick={(e) => {
            e.stopPropagation()
            speak(card.tibetan)
          }}
        >
          {audioLoading ? '…' : bo.modules.listen}
        </button>
        <button type="button" className="btn btn-accent" disabled={mastered} onClick={master}>
          {mastered ? bo.modules.mastered : bo.modules.markMastered}
        </button>
        <button type="button" className="btn btn-primary" onClick={next}>
          {bo.modules.nextCard}
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          {bo.modules.restart}
        </button>
      </div>
    </div>
  )
}

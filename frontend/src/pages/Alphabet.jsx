import { useMemo, useState } from 'react'
import { CONSONANTS, VOWELS } from '../data/tibetan'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePicker from '../components/VoicePicker'
import { bo } from '../i18n/bo'

const GROUPS = [
  { key: 'velar', label: 'Velar' },
  { key: 'palatal', label: 'Palatal' },
  { key: 'dental', label: 'Dental' },
  { key: 'labial', label: 'Labial' },
  { key: 'affricate', label: 'Affricate' },
  { key: 'sibilant', label: 'Sibilant' },
  { key: 'semivowel', label: 'Semivowel' },
  { key: 'liquid', label: 'Liquid' },
  { key: 'guttural', label: 'Guttural' },
]

export default function Alphabet() {
  const { progress, markItem } = useModuleProgress()
  const [active, setActive] = useState(null)
  const [filter, setFilter] = useState('all')
  const { voice, setVoice, speak, loading: audioLoading } = useTibetanVoice()

  const list = useMemo(() => {
    if (filter === 'all') return CONSONANTS
    return CONSONANTS.filter((c) => c.group === filter)
  }, [filter])

  const mastered = progress.mastered_letters || []

  async function markMastered(id) {
    if (mastered.includes(id)) return
    try {
      await markItem('letter', id, 5)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="module-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{bo.modules.alphabetEyebrow}</p>
          <h1>{bo.modules.alphabetTitle}</h1>
          <p>{bo.modules.alphabetSub}</p>
        </div>
        <VoicePicker value={voice} onChange={setVoice} />
      </header>

      <div className="chip-row">
        <button
          type="button"
          className={`chip-btn ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All 30
        </button>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`chip-btn ${filter === g.key ? 'is-active' : ''}`}
            onClick={() => setFilter(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="letter-grid">
        {list.map((c) => {
          const done = mastered.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              className={`letter-tile ${done ? 'is-mastered' : ''}`}
              onClick={() => setActive(c)}
            >
              {done && <span className="letter-check">✓</span>}
              <span className="letter-glyph tibetan">{c.letter}</span>
              <span className="letter-latin" dir="ltr">
                {c.latin}
              </span>
            </button>
          )
        })}
      </div>

      <h2 className="module-section-title">{bo.modules.vowels}</h2>
      <div className="letter-grid letter-grid-vowels">
        {VOWELS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="letter-tile"
            onClick={() => setActive(v)}
          >
            <span className="letter-glyph tibetan">{v.letter}</span>
            <span className="letter-latin" dir="ltr">
              {v.latin}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={() => setActive(null)} role="presentation">
          <div className="modal-card panel" onClick={(e) => e.stopPropagation()} role="dialog">
            <button type="button" className="modal-close btn btn-ghost" onClick={() => setActive(null)}>
              ✕
            </button>
            <div className="modal-letter tibetan">{active.letter}</div>
            <div className="modal-latin" dir="ltr">
              {active.latin}
            </div>
            <p className="muted" dir="ltr">
              Wylie: {active.wylie}
              {active.group ? ` · ${active.group}` : ''}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={audioLoading}
                onClick={() => speak(active.letter)}
              >
                {audioLoading ? '…' : bo.modules.listen}
              </button>
              {active.id?.startsWith('c') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    markMastered(active.id)
                    setActive(null)
                  }}
                >
                  {bo.modules.markMastered}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

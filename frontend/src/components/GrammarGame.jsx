import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { tibetanOrFallback } from '../i18n/labels'
import { playFanfare, playLose, playWin, unlockAudio } from '../lib/gameSfx'
import OfflineBanner from './OfflineBanner'
import WorkingProgress from './WorkingProgress'

const TOPICS = [
  { id: 'particles', labelKey: 'topicParticles', hintKey: 'topicParticlesHint' },
  { id: 'case', labelKey: 'topicCase', hintKey: 'topicCaseHint' },
  { id: 'honorific', labelKey: 'topicHonorific', hintKey: 'topicHonorificHint' },
  { id: 'verbs', labelKey: 'topicVerbs', hintKey: 'topicVerbsHint' },
  { id: 'mistakes', labelKey: 'topicMistakes', hintKey: 'topicMistakesHint' },
]

const OPTION_MARKS = ['ཀ', 'ཁ', 'ག', 'ང']

/** Split Tibetan sentence into tappable chunks; keep error_span as one token when present. */
function tokenizeSentence(sentence, errorSpan) {
  const text = String(sentence || '')
  if (!text) return []
  const span = String(errorSpan || '').trim()
  if (span && text.includes(span)) {
    const parts = []
    let remaining = text
    let key = 0
    while (remaining.length) {
      const idx = remaining.indexOf(span)
      if (idx === -1) {
        parts.push(...chunkTibetan(remaining, key))
        break
      }
      if (idx > 0) {
        const before = chunkTibetan(remaining.slice(0, idx), key)
        parts.push(...before)
        key += before.length
      }
      parts.push({ key: `e-${key++}`, text: span, isError: true })
      remaining = remaining.slice(idx + span.length)
    }
    return parts
  }
  return chunkTibetan(text, 0)
}

function chunkTibetan(text, startKey = 0) {
  // Split on tsheg/shad/space but keep ་ with the preceding syllable.
  const chunks = String(text || '')
    .split(/([་།\s]+)/)
    .filter((p) => p.length)
  const out = []
  let key = startKey
  let current = ''
  const flush = () => {
    if (!current) return
    out.push({ key: `t-${key++}`, text: current, isError: false })
    current = ''
  }
  for (const part of chunks) {
    if (/^[་།\s]+$/.test(part)) {
      if (current) {
        current += part
        flush()
      } else if (out.length) {
        out[out.length - 1].text += part
      } else {
        current = part
      }
      continue
    }
    flush()
    current = part
  }
  flush()
  return out
}

function BlankSentence({ sentence }) {
  const text = String(sentence || '')
  const parts = text.split(/(______|___)/)
  return (
    <div className="gq-sentence gq-sentence-static tibetan">
      {parts.map((part, i) =>
        part === '______' || part === '___' ? (
          <span key={i} className="gq-blank">
            ———
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  )
}

function RoundFeedback({ round, correct }) {
  const { t } = useI18n()
  return (
    <div className={`gq-feedback ${correct ? 'is-ok' : 'is-bad'}`}>
      <p className="gq-feedback-title">{correct ? t.grammar.correct : t.grammar.wrong}</p>
      {round.answer && (
        <p className="gq-fix">
          {t.grammar.fixIs} <strong className="tibetan">{round.answer}</strong>
        </p>
      )}
      {round.explanation && (
        <p className="gq-explain">{tibetanOrFallback(round.explanation, round.explanation)}</p>
      )}
      {round.related_rule && (
        <p className="gq-rule">
          <strong>{t.grammar.rule}</strong>{' '}
          {tibetanOrFallback(round.related_rule, round.related_rule)}
        </p>
      )}
    </div>
  )
}

export default function GrammarGame({
  onRequestCheck,
  generateGame,
}) {
  const { t } = useI18n()

  const [phase, setPhase] = useState('lobby') // lobby | play | done
  const [topic, setTopic] = useState('particles')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [locked, setLocked] = useState(false)
  const [picked, setPicked] = useState(null)
  const [spotHit, setSpotHit] = useState(null) // 'ok' | 'bad' | null
  const [shakeKey, setShakeKey] = useState(0)

  const rounds = session?.rounds || []
  const round = rounds[idx]
  const tokens = useMemo(
    () => (round ? tokenizeSentence(round.sentence, round.error_span) : []),
    [round],
  )

  async function start(selectedTopic = topic) {
    unlockAudio()
    setBusy(true)
    setError('')
    try {
      const data = await generateGame(selectedTopic)
      setSession(data)
      setTopic(selectedTopic)
      setIdx(0)
      setScore(0)
      setStreak(0)
      setBestStreak(0)
      setLocked(false)
      setPicked(null)
      setSpotHit(null)
      setPhase('play')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  function markResult(ok) {
    if (ok) {
      playWin()
      setScore((s) => s + 1)
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        return next
      })
    } else {
      playLose()
      setStreak(0)
    }
    setLocked(true)
  }

  function onPick(option) {
    if (!round || locked) return
    unlockAudio()
    setPicked(option)
    markResult(String(option) === String(round.answer))
  }

  function onSpot(token) {
    if (!round || locked) return
    unlockAudio()
    const ok = Boolean(token.isError)
    setSpotHit(ok ? 'ok' : 'bad')
    if (!ok) {
      setShakeKey((k) => k + 1)
      playLose()
      return
    }
    markResult(true)
  }

  function goNext() {
    if (idx >= rounds.length - 1) {
      playFanfare()
      setPhase('done')
      return
    }
    setIdx((i) => i + 1)
    setLocked(false)
    setPicked(null)
    setSpotHit(null)
  }

  if (phase === 'lobby') {
    return (
      <div className="panel gq-lobby tibetan">
        <header className="gq-lobby-head">
          <p className="module-eyebrow">{t.grammar.questTitle}</p>
          <h2 style={{ marginTop: 0 }}>{t.grammar.pickTopic}</h2>
          <p className="muted">{t.grammar.questSub}</p>
        </header>

        <div className="gq-topic-grid" role="listbox" aria-label={t.grammar.pickTopic}>
          {TOPICS.map((item) => {
            const on = topic === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`gq-topic-card ${on ? 'is-on' : ''}`}
                onClick={() => setTopic(item.id)}
              >
                <span className="gq-topic-radio" aria-hidden>
                  {on ? '✓' : ''}
                </span>
                <span className="gq-topic-copy">
                  <span className="gq-topic-title">{t.grammar[item.labelKey]}</span>
                  <span className="gq-topic-hint">{t.grammar[item.hintKey]}</span>
                </span>
              </button>
            )
          })}
        </div>

        {error && <p className="error">{error}</p>}

        <WorkingProgress
          active={busy}
          title={t.grammar.gameTitle}
          stages={[t.grammar.gameStage1, t.grammar.gameStage2, t.grammar.gameStage3]}
          compact
        />

        <button
          type="button"
          className="btn btn-primary gq-start"
          disabled={busy}
          onClick={() => start(topic)}
        >
          {busy ? t.grammar.loadingGame : t.grammar.startGame}
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    const sources = session?.retrieved_sources || []
    return (
      <div className="panel gq-done tibetan">
        <h2 style={{ marginTop: 0 }}>{t.grammar.doneTitle}</h2>
        <p className="muted">{t.grammar.doneSub}</p>
        <div className="gq-hud gq-hud-done">
          <div>
            <span className="muted">{t.grammar.score}</span>
            <strong dir="ltr">
              {score}/{rounds.length}
            </strong>
          </div>
          <div>
            <span className="muted">{t.grammar.streak}</span>
            <strong dir="ltr">{bestStreak}</strong>
          </div>
        </div>
        <OfflineBanner
          offline={session?.offline}
          source={session?.source}
          message={
            session?.source === 'rag' || session?.source === 'rag-bank'
              ? t.grammar.fromHandbook
              : t.grammar.offlineNote
          }
        />
        {!!sources.length && (
          <section className="gq-sources">
            <h4>{t.grammar.sources}</h4>
            <ul>
              {sources.slice(0, 3).map((s, i) => (
                <li key={i}>
                  <strong>
                    {t.grammar.page} {s.page_number ?? '—'}
                  </strong>
                  {s.excerpt ? <p className="source-excerpt">{s.excerpt}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="gq-done-actions">
          <WorkingProgress
            active={busy}
            title={t.grammar.gameTitle}
            stages={[t.grammar.gameStage1, t.grammar.gameStage2, t.grammar.gameStage3]}
            compact
          />
          <button type="button" className="btn btn-primary" onClick={() => start(topic)} disabled={busy}>
            {busy ? t.grammar.loadingGame : t.grammar.playAgain}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setPhase('lobby')}>
            {t.grammar.changeTopic}
          </button>
          {onRequestCheck && (
            <button type="button" className="btn btn-accent" onClick={onRequestCheck}>
              {t.grammar.goCheck}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="panel tibetan">
        <p className="error">{error || '—'}</p>
        <button type="button" className="btn btn-ghost" onClick={() => setPhase('lobby')}>
          {t.grammar.changeTopic}
        </button>
      </div>
    )
  }

  const isSpot = round.type === 'spot'

  return (
    <div className="panel gq-play tibetan">
      <div className="gq-hud">
        <div className="gq-progress">
          <span>
            {t.grammar.roundOf}{' '}
            <strong dir="ltr">
              {idx + 1}/{rounds.length}
            </strong>
          </span>
          <div className="gq-dots" aria-hidden>
            {rounds.map((_, i) => (
              <span key={i} className={`gq-dot ${i < idx ? 'is-done' : ''} ${i === idx ? 'is-now' : ''}`} />
            ))}
          </div>
        </div>
        <div className="gq-stats">
          <span>
            {t.grammar.score} <strong dir="ltr">{score}</strong>
          </span>
          <span>
            {t.grammar.streak} <strong dir="ltr">{streak}</strong>
          </span>
        </div>
      </div>

      {session?.source && (
        <p className={`gq-source-badge source-${session.source}`}>
          {session.source === 'melong'
            ? t.grammar.fromMelong
            : session.source === 'bank'
              ? t.grammar.fromBank
              : t.grammar.fromHandbook}
          {round.source_ref ? ` · ${round.source_ref}` : ''}
        </p>
      )}

      <p className="gq-prompt">{round.prompt}</p>
      <p className="muted gq-hint">{isSpot ? t.grammar.tapWrong : t.grammar.pickAnswer}</p>

      {(round.handbook_excerpt || (session?.retrieved_sources || [])[0]?.excerpt) && (
        <aside className="gq-handbook-card">
          <div className="gq-handbook-label">{t.grammar.handbookBit}</div>
          <p dir="auto">
            {round.handbook_excerpt || session.retrieved_sources[0].excerpt}
          </p>
        </aside>
      )}

      {isSpot ? (
        <div key={shakeKey} className={`gq-sentence ${spotHit === 'bad' ? 'is-shake' : ''}`}>
          {tokens.map((tok) => (
            <button
              key={tok.key}
              type="button"
              className={`gq-token ${tok.isError && locked ? 'is-error' : ''} ${
                locked && tok.isError ? 'is-revealed' : ''
              }`}
              disabled={locked}
              onClick={() => onSpot(tok)}
            >
              {tok.text}
            </button>
          ))}
        </div>
      ) : (
        <>
          <BlankSentence sentence={round.sentence} />
          <div className="gq-options">
            {(round.options || []).map((opt, oi) => {
              const isPicked = picked === opt
              const isAnswer = locked && opt === round.answer
              const isWrong = locked && isPicked && opt !== round.answer
              return (
                <button
                  key={`${opt}-${oi}`}
                  type="button"
                  className={`gq-option ${isPicked ? 'is-picked' : ''} ${isAnswer ? 'is-correct' : ''} ${
                    isWrong ? 'is-wrong' : ''
                  }`}
                  disabled={locked}
                  onClick={() => onPick(opt)}
                >
                  <span className="gq-option-mark" dir="ltr">
                    {OPTION_MARKS[oi] || oi + 1}
                  </span>
                  <span className="gq-option-text tibetan">{opt}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {locked && <RoundFeedback round={round} correct={spotHit === 'ok' || picked === round.answer} />}

      {locked && (
        <button type="button" className="btn btn-primary gq-next" onClick={goNext}>
          {idx >= rounds.length - 1 ? t.grammar.seeResult : t.grammar.nextRound}
        </button>
      )}
    </div>
  )
}

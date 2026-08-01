import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, clearApiCache } from '../api/client'
import WorkingProgress from '../components/WorkingProgress'
import { useI18n } from '../i18n/useI18n'

const FOCUS_KEYS = [
  { id: '', labelKey: 'focusAdaptive' },
  { id: 'རྣམ་དབྱེ།', labelKey: 'focusCase' },
  { id: 'ཡིན་རེད་ཡོད་འདུག', labelKey: 'focusCopula' },
  { id: 'ཕྲད།', labelKey: 'focusParticles' },
  { id: 'མིང་ཚིག', labelKey: 'focusVocab' },
  { id: 'ཞེ་ས།', labelKey: 'focusHonorific' },
]

function optionLabel(opt) {
  if (opt == null) return ''
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt)
  if (typeof opt === 'object') return String(opt.text ?? opt.label ?? opt.value ?? JSON.stringify(opt))
  return String(opt)
}

function optionValue(opt) {
  if (opt == null) return ''
  if (typeof opt === 'string' || typeof opt === 'number') return String(opt)
  if (typeof opt === 'object') return String(opt.value ?? opt.text ?? opt.label ?? '')
  return String(opt)
}

function exerciseKey(ex, index) {
  return ex?.id != null && String(ex.id).trim() ? String(ex.id) : `ex-${index}`
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null) return ''
  return String(value)
}

function typeLabel(type, t) {
  const map = {
    fill_blank: t.practice.typeFill,
    correct_sentence: t.practice.typeCorrect,
    honorific_choice: t.practice.typeHonorific,
    translate: t.practice.typeTranslate,
    match_word: t.practice.typeMatch,
    free_write: t.practice.typeWrite,
    particle_pick: t.practice.typeParticle,
    reorder_phrase: t.practice.typeReorder,
  }
  return map[type] || t.practice.typeGeneric
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function Practice() {
  const { t } = useI18n()
  const [params] = useSearchParams()

  const [session, setSession] = useState(null)
  const [history, setHistory] = useState([])
  const [answers, setAnswers] = useState({})
  const [focus, setFocus] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState(null) // 'generate' | 'submit'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reward, setReward] = useState(null)
  const [nextLesson, setNextLesson] = useState(null)

  const exercises = useMemo(() => {
    const list = session?.exercises_json?.exercises
    return Array.isArray(list) ? list : []
  }, [session])

  const itemResults = useMemo(() => {
    const rows = session?.exercises_json?.item_results
    if (!Array.isArray(rows)) return {}
    const map = {}
    for (const row of rows) {
      if (row?.id != null) map[String(row.id)] = row
    }
    return map
  }, [session])

  const answeredCount = useMemo(
    () => exercises.filter((ex, i) => String(answers[exerciseKey(ex, i)] || '').trim()).length,
    [exercises, answers],
  )

  const genStages = useMemo(
    () => [t.practice.genStage1, t.practice.genStage2, t.practice.genStage3],
    [t],
  )

  async function loadHistory() {
    try {
      const rows = await api.practiceHistory()
      setHistory(Array.isArray(rows) ? rows.slice(0, 8) : [])
    } catch {
      setHistory([])
    }
  }

  useEffect(() => {
    let cancelled = false
    const focusParam = params.get('focus') || ''
    const shouldAuto = params.get('auto') === '1'
    const fromGrammar = params.get('from') === 'grammar'

    if (focusParam) setFocus(focusParam)

    ;(async () => {
      try {
        const latest = await api.getLatestPractice()
        if (cancelled) return
        setSession(latest)
        const list = latest?.exercises_json?.exercises
        if (Array.isArray(list) && list.length) setStep(0)
        if (latest?.exercises_json?.submitted_answers) {
          setAnswers(latest.exercises_json.submitted_answers)
        }
      } catch {
        /* empty */
      }
      try {
        const dash = await api.getDashboard()
        if (!cancelled) setNextLesson(dash?.next_lesson || null)
      } catch {
        if (!cancelled) setNextLesson(null)
      }
      if (!cancelled) await loadHistory()
      if (cancelled) return

      if (fromGrammar || shouldAuto) {
        setMessage(t.practice.fromGrammarHint)
      }
      if (!shouldAuto) return

      setBusy(true)
      setBusyKind('generate')
      setError('')
      setReward(null)
      try {
        const data = await api.generatePractice(focusParam || null)
        if (cancelled) return
        setSession(data)
        setAnswers({})
        setStep(0)
        setMessage(t.practice.ready)
        clearApiCache('GET:/api/practice')
        clearApiCache('GET:/api/progress')
        clearApiCache('GET:/api/dashboard')
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) {
          setBusy(false)
          setBusyKind(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Deep-link params only matter on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generate() {
    setBusy(true)
    setBusyKind('generate')
    setError('')
    setMessage('')
    setReward(null)
    try {
      const data = await api.generatePractice(focus || null)
      setSession(data)
      setAnswers({})
      setStep(0)
      setMessage(t.practice.ready)
      clearApiCache('GET:/api/practice')
      clearApiCache('GET:/api/progress')
      clearApiCache('GET:/api/dashboard')
      await loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function setAnswer(key, value) {
    if (session?.completed) return
    setAnswers((a) => ({ ...a, [key]: value }))
    setError('')
  }

  function pickOption(key, value) {
    setAnswer(key, value)
    // Advance after a choice so kids aren't stranded on a question.
    if (step < exercises.length - 1) {
      window.setTimeout(() => setStep((s) => Math.min(s + 1, exercises.length - 1)), 180)
    }
  }

  function firstUnansweredIndex() {
    for (let i = 0; i < exercises.length; i += 1) {
      const key = exerciseKey(exercises[i], i)
      if (!String(answers[key] || '').trim()) return i
    }
    return -1
  }

  async function submit() {
    if (!session || session.completed) return
    const missing = firstUnansweredIndex()
    if (missing >= 0) {
      setStep(missing)
      setError(t.practice.answerAll)
      return
    }
    setBusy(true)
    setBusyKind('submit')
    setError('')
    try {
      const updated = await api.submitPractice({
        practice_id: session.id,
        answers,
      })
      setSession(updated)
      const score = Math.round(updated.score ?? 0)
      const r = updated.exercises_json?.reward || null
      setReward(r)
      setMessage(
        r
          ? `${t.practice.submitted} ${score} · +${r.xp} XP · ${t.practice.streak} ${r.streak}`
          : `${t.practice.submitted} ${score}`,
      )
      clearApiCache('GET:/api/practice')
      clearApiCache('GET:/api/progress')
      clearApiCache('GET:/api/dashboard')
      await loadHistory()
      try {
        const dash = await api.getDashboard()
        setNextLesson(dash?.next_lesson || null)
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function goNext() {
    if (step < exercises.length - 1) setStep((s) => s + 1)
  }
  function goPrev() {
    if (step > 0) setStep((s) => s - 1)
  }

  const current = exercises[step]
  const currentKey = current ? exerciseKey(current, step) : ''
  const options = Array.isArray(current?.options) ? current.options : []
  const isWrite = (current?.type || '') === 'free_write' || (!options.length && current)
  const resultRow = currentKey ? itemResults[currentKey] : null
  const progressPct = exercises.length
    ? Math.round((answeredCount / exercises.length) * 100)
    : 0

  return (
    <div className="tibetan practice-page">
      <header className="page-header">
        <div>
          <h1>{t.practice.title}</h1>
          <p>{t.practice.sub}</p>
        </div>
        <div className="practice-header-actions">
          <Link className="btn btn-ghost" to="/progress">
            {t.practice.seeProgress}
          </Link>
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            {busyKind === 'generate' ? t.practice.generating : t.practice.generate}
          </button>
        </div>
      </header>

      <div className="practice-focus-row" role="group" aria-label={t.practice.focus}>
        <span className="practice-focus-label">{t.practice.focus}</span>
        {FOCUS_KEYS.map((f) => (
          <button
            key={f.id || 'adaptive'}
            type="button"
            className={`practice-focus-chip ${focus === f.id ? 'is-on' : ''}`}
            disabled={busy}
            onClick={() => setFocus(f.id)}
          >
            {t.practice[f.labelKey]}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {reward && session?.completed && (
        <div className="practice-reward-toast" role="status">
          <div className="practice-reward-xp" dir="ltr">
            +{reward.xp} XP
          </div>
          <div className="practice-reward-body">
            <p>
              {t.practice.streak}: <strong dir="ltr">{reward.streak}</strong>
              {reward.best_streak ? (
                <>
                  {' '}
                  · {t.practice.bestStreak} <span dir="ltr">{reward.best_streak}</span>
                </>
              ) : null}
            </p>
            <p className="muted">{t.practice.comeBack}</p>
            <div className="practice-reward-actions">
              {nextLesson?.id ? (
                <Link className="btn btn-primary" to={`/lessons/${nextLesson.id}`}>
                  {t.practice.nextLesson}
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/learning-path">
                  {t.practice.viewPath}
                </Link>
              )}
              <Link className="btn btn-ghost" to="/story">
                {t.nav.story}
              </Link>
            </div>
          </div>
        </div>
      )}

      <WorkingProgress
        active={busyKind === 'generate'}
        title={t.practice.generating}
        stages={genStages}
      />

      <div className="practice-layout">
        <div className="practice-main">
          {!session && !busy && <div className="empty panel">{t.practice.empty}</div>}

          {session && exercises.length === 0 && (
            <div className="empty panel">{t.practice.noExercises}</div>
          )}

          {session && exercises.length > 0 && (
            <div className="panel practice-session">
              <div className="practice-session-head">
                <div>
                  <h2 style={{ margin: 0 }}>
                    {session.exercises_json?.title || t.practice.title}
                  </h2>
                  <p className="muted practice-focus-areas">
                    {(session.exercises_json?.focus_areas || []).join(' · ') || '—'}
                  </p>
                </div>
                {session.completed ? (
                  <div className="practice-score-badge" dir="ltr">
                    {Math.round(session.score ?? 0)}
                    <span>{t.practice.scoreUnit}</span>
                  </div>
                ) : (
                  <div className="practice-count-badge" dir="ltr">
                    {answeredCount}/{exercises.length}
                  </div>
                )}
              </div>

              <div className="practice-progress-track" aria-hidden>
                <div
                  className="practice-progress-fill"
                  style={{ width: `${session.completed ? 100 : progressPct}%` }}
                />
              </div>
              <p className="practice-progress-meta muted">
                {session.completed
                  ? t.practice.doneReview
                  : `${t.practice.answered} ${answeredCount} / ${exercises.length}`}
              </p>

              <div className="practice-step-rail" role="tablist">
                {exercises.map((ex, i) => {
                  const key = exerciseKey(ex, i)
                  const answered = Boolean(String(answers[key] || '').trim())
                  const res = itemResults[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={i === step}
                      className={`practice-step-dot ${i === step ? 'is-on' : ''} ${
                        answered ? 'is-answered' : ''
                      } ${res?.correct === true ? 'is-correct' : ''} ${
                        res?.correct === false ? 'is-wrong' : ''
                      }`}
                      onClick={() => setStep(i)}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>

              {current && (
                <div className="practice-card">
                  <div className="practice-card-meta">
                    <span className="practice-type-pill">
                      {typeLabel(current.type, t)}
                    </span>
                    <span className="muted" dir="ltr">
                      {step + 1} / {exercises.length}
                    </span>
                  </div>
                  <p className="practice-prompt tibetan">{current.prompt}</p>

                  {Array.isArray(current.tokens) && current.tokens.length > 0 ? (
                    <div className="practice-tokens" aria-label="scrambled">
                      {current.tokens.map((tok, ti) => (
                        <span key={`${currentKey}-tok-${ti}`} className="practice-token tibetan">
                          {tok}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {options.length > 0 ? (
                    <div className="practice-options" role="listbox">
                      {options.map((opt, oi) => {
                        const val = optionValue(opt)
                        const on = answers[currentKey] === val
                        return (
                          <button
                            key={`${currentKey}-opt-${oi}`}
                            type="button"
                            role="option"
                            aria-selected={on}
                            className={`practice-option ${on ? 'is-on' : ''}`}
                            disabled={session.completed || busy}
                            onClick={() => pickOption(currentKey, val)}
                          >
                            <span className="practice-option-mark" aria-hidden>
                              {['ཀ', 'ཁ', 'ག', 'ང', 'ཅ', 'ཆ'][oi] || oi + 1}
                            </span>
                            <span className="tibetan">{optionLabel(opt)}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <textarea
                      className="tibetan practice-write"
                      rows={isWrite ? 4 : 2}
                      disabled={session.completed || busy}
                      value={answers[currentKey] || ''}
                      onChange={(e) => setAnswer(currentKey, e.target.value)}
                      placeholder={t.practice.writeHint}
                    />
                  )}

                  {session.completed && (
                    <div
                      className={`practice-feedback ${
                        resultRow?.correct ? 'is-correct' : 'is-wrong'
                      }`}
                    >
                      <p className="practice-feedback-status">
                        {resultRow?.correct ? t.practice.correct : t.practice.incorrect}
                      </p>
                      <p className="tibetan" style={{ margin: '4px 0 0' }}>
                        {t.practice.answer}: {normalizeAnswer(current.answer)}
                      </p>
                      {current.explanation && (
                        <p className="muted" style={{ margin: '6px 0 0' }}>
                          {current.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {error ? <p className="error practice-card-error">{error}</p> : null}

                  <div className="practice-nav">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={goPrev}
                      disabled={step === 0 || busy}
                    >
                      {t.practice.prev}
                    </button>
                    {step < exercises.length - 1 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={goNext}
                        disabled={busy}
                      >
                        {t.practice.next}
                      </button>
                    ) : !session.completed ? (
                      <button
                        type="button"
                        className="btn btn-primary practice-finish-btn"
                        onClick={submit}
                        disabled={busy || !String(answers[currentKey] || '').trim()}
                      >
                        {busyKind === 'submit'
                          ? t.practice.submitting
                          : t.practice.finish || t.practice.submit}
                      </button>
                    ) : (
                      <div className="practice-done-actions">
                        {nextLesson?.id ? (
                          <Link className="btn btn-accent" to={`/lessons/${nextLesson.id}`}>
                            {t.practice.nextLesson}
                          </Link>
                        ) : null}
                        <Link className="btn btn-ghost" to="/progress">
                          {t.practice.seeProgress}
                        </Link>
                      </div>
                    )}
                  </div>
                  {step >= exercises.length - 1 &&
                  !session.completed &&
                  !String(answers[currentKey] || '').trim() ? (
                    <p className="muted practice-pick-hint">{t.practice.pickThenFinish}</p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="panel practice-history">
          <h3 style={{ marginTop: 0 }}>{t.practice.history}</h3>
          {!history.length && <p className="muted">{t.practice.historyEmpty}</p>}
          <ul className="practice-history-list">
            {history.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`practice-history-item ${
                    session?.id === row.id ? 'is-on' : ''
                  }`}
                  onClick={() => {
                    setSession(row)
                    setAnswers(row.exercises_json?.submitted_answers || {})
                    setStep(0)
                    setMessage('')
                    setError('')
                  }}
                >
                  <span className="practice-history-title">
                    {row.exercises_json?.title || t.practice.title}
                  </span>
                  <span className="practice-history-meta muted">
                    {formatWhen(row.created_at)}
                    {' · '}
                    {row.completed
                      ? `${Math.round(row.score ?? 0)} ${t.practice.scoreUnit}`
                      : t.practice.openSession}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

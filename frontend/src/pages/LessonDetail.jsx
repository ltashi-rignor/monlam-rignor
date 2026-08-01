import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, clearApiCache } from '../api/client'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import VoicePicker from '../components/VoicePicker'
import { playFanfare, playLose, playWin, unlockAudio } from '../lib/gameSfx'
import { bo } from '../i18n/bo'
import { tibetanOrFallback } from '../i18n/labels'

const STEPS = ['intro', 'words', 'dialogue', 'notes', 'quiz', 'done']
const STEP_LABELS = {
  intro: 'stepIntro',
  words: 'stepWords',
  dialogue: 'stepDialogue',
  notes: 'stepNotes',
  quiz: 'stepQuiz',
}

const FX_COLORS = ['#1a6b76', '#c47a16', '#2a9d8f', '#e9c46a', '#f4a261', '#0d3d45']

function makeFx(n = 18) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    left: 4 + Math.random() * 92,
    delay: Math.random() * 0.4,
    dur: 1.4 + Math.random() * 1.2,
    size: 10 + Math.random() * 14,
    color: FX_COLORS[i % FX_COLORS.length],
    kind: i % 3 === 0 ? 'balloon' : 'confetti',
  }))
}

function splitNotes(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = raw
    .split(/(?<=[།.!?\n])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 2) return parts.slice(0, 8)
  const chunks = []
  let buf = ''
  for (const ch of raw) {
    buf += ch
    if (buf.length > 48 && /[་།\s]/.test(ch)) {
      chunks.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.slice(0, 8)
}

/** Strip 「」/quotes and color the highlighted word in quiz prompts. */
function QuizPrompt({ text, highlight }) {
  const raw = tibetanOrFallback(text, text || '')
  let focus = String(highlight || '').trim()
  let clean = raw

  if (!focus) {
    const m = raw.match(/[「『"'“‘]([^」』"'”’]+)[」』"'”’]/)
    if (m) focus = m[1].trim()
  }

  if (focus) {
    const wrapped = new RegExp(
      `[「『"'“‘]?${focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[」』"'”’]?`,
    )
    clean = raw.replace(wrapped, focus)
    const idx = clean.indexOf(focus)
    if (idx >= 0) {
      return (
        <>
          {clean.slice(0, idx)}
          <span className="quiz-word">{focus}</span>
          {clean.slice(idx + focus.length)}
        </>
      )
    }
  }

  // Fallback: strip any leftover corner brackets
  clean = clean.replace(/[「『」』]/g, '')
  return <>{clean}</>
}

export default function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { submitQuiz } = useModuleProgress()
  const { speak, voice, setVoice } = useTibetanVoice()
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState('intro')
  const [maxStep, setMaxStep] = useState(0)
  const [flipped, setFlipped] = useState({})
  const [heard, setHeard] = useState({})
  const [dialogueIdx, setDialogueIdx] = useState(0)
  const [showEn, setShowEn] = useState({})
  const [revealedNotes, setRevealedNotes] = useState({})
  const [answers, setAnswers] = useState({})
  const [locked, setLocked] = useState({})
  const [liveScore, setLiveScore] = useState(0)
  const [quizResult, setQuizResult] = useState(null)
  const [regenBusy, setRegenBusy] = useState(false)
  const [fx, setFx] = useState([])

  async function load(regenerate = false) {
    setLoading(true)
    setError('')
    try {
      const data = regenerate
        ? await api.regenerateInteractiveLesson(id)
        : await api.getInteractiveLesson(id)
      setLesson(data)
      setStep('intro')
      setMaxStep(0)
      setFlipped({})
      setHeard({})
      setDialogueIdx(0)
      setShowEn({})
      setRevealedNotes({})
      setAnswers({})
      setLocked({})
      setLiveScore(0)
      setQuizResult(null)
      setFx([])
      clearApiCache('GET:/api/modules/lessons')
    } catch (err) {
      const msg = err.message || ''
      if (/429|rate limit/i.test(msg)) {
        setError(bo.modules.rateLimited)
      } else {
        setError(msg)
      }
      setLesson(null)
    } finally {
      setLoading(false)
      setRegenBusy(false)
    }
  }

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const words = useMemo(() => {
    if (!lesson?.words) return []
    return lesson.words.filter((w) => w?.tibetan)
  }, [lesson])

  const notesChunks = useMemo(
    () => splitNotes(tibetanOrFallback(lesson?.notes, lesson?.notes || '')),
    [lesson],
  )

  const dialogue = lesson?.dialogue || []
  const quiz = lesson?.quiz || []

  function goToStep(name) {
    const i = STEPS.indexOf(name)
    if (i < 0 || i > maxStep) return
    setStep(name)
  }

  function advance(nextName) {
    const i = STEPS.indexOf(nextName)
    if (i > maxStep) setMaxStep(i)
    setStep(nextName)
  }

  const next = () => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) advance(STEPS[i + 1])
  }
  const prev = () => {
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  async function onSpeak(text, key) {
    unlockAudio()
    if (!text) return
    await speak(text)
    if (key != null) setHeard((h) => ({ ...h, [key]: true }))
    await new Promise((r) => setTimeout(r, Math.min(3200, 500 + String(text).length * 70)))
  }

  function flipCard(wid) {
    setFlipped((f) => ({ ...f, [wid]: !f[wid] }))
  }

  function onPickAnswer(qi, optIdx) {
    if (locked[qi]) return
    const correct = quiz[qi]?.answer === optIdx
    setAnswers((a) => ({ ...a, [qi]: optIdx }))
    setLocked((l) => ({ ...l, [qi]: true }))
    unlockAudio()
    if (correct) {
      playWin()
      setLiveScore((s) => s + 1)
    } else {
      playLose()
    }
  }

  async function onSubmitQuiz() {
    const total = quiz.length || 0
    const score = liveScore
    setQuizResult({ score, total })
    try {
      await submitQuiz(lesson.id, score, total || 1)
      clearApiCache('GET:/api/modules/lessons')
      clearApiCache('GET:/api/planner/roadmap')
      clearApiCache('GET:/api/dashboard')
    } catch {
      /* ignore */
    }
    unlockAudio()
    playFanfare()
    setFx(makeFx(22))
    window.setTimeout(() => setFx([]), 2800)
    advance('done')
  }

  async function playDialogueAll() {
    unlockAudio()
    for (let i = 0; i < dialogue.length; i += 1) {
      setDialogueIdx(i)
      const line = dialogue[i]
      if (line?.tibetan) await onSpeak(line.tibetan)
      else await new Promise((r) => setTimeout(r, 400))
    }
  }

  if (loading) {
    return (
      <div className="empty panel tibetan lesson-loading">
        <div className="lesson-shimmer" aria-hidden />
        <p>{bo.modules.generatingLesson}</p>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="empty panel tibetan">
        <p className="error">{error || bo.modules.lessonMissing}</p>
        <div className="module-actions">
          <Link className="btn btn-ghost" to="/lessons">
            {bo.modules.backLessons}
          </Link>
          <Link className="btn btn-primary" to="/learning-path">
            {bo.modules.openPath}
          </Link>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.indexOf(step)
  const title = tibetanOrFallback(lesson.tibetan_title || lesson.title, lesson.title)
  const focus = tibetanOrFallback(lesson.focus, '')
  const allQuizAnswered = quiz.length > 0 && Object.keys(locked).length >= quiz.length
  const wordsHeard = Object.keys(heard).length

  return (
    <div className="module-page lesson-detail-page lesson-play tibetan">
      {fx.map((p) => (
        <span
          key={p.id}
          className={`lesson-fx ${p.kind}`}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            width: p.size,
            height: p.size * (p.kind === 'balloon' ? 1.25 : 1),
            background: p.color,
          }}
        />
      ))}

      <div className="page-header" style={{ marginBottom: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/lessons')}>
          ← {bo.modules.backLessons}
        </button>
        <div className="lesson-top-tools">
          <VoicePicker value={voice} onChange={setVoice} />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={regenBusy}
            onClick={() => {
              setRegenBusy(true)
              load(true)
            }}
          >
            {regenBusy ? bo.modules.generatingLesson : bo.modules.regenLesson}
          </button>
        </div>
      </div>

      <header className="page-header lesson-play-hero" style={{ marginTop: 4 }}>
        <div>
          <p className="module-eyebrow">
            {bo.learningPath.week} {lesson.week_number}
            {lesson.level ? ` · ${tibetanOrFallback(lesson.level, lesson.level)}` : ''} ·{' '}
            <span dir="ltr">{lesson.minutes} min</span>
          </p>
          <h1>{title}</h1>
          {focus && <p className="muted">{focus}</p>}
          {lesson.offline && <p className="muted">{bo.modules.offlineLesson}</p>}
        </div>
      </header>

      <div className="step-rail" role="tablist" aria-label="steps">
        {STEPS.slice(0, 5).map((s, i) => {
          const unlocked = i <= maxStep
          const on = stepIndex === i
          const done = stepIndex > i || maxStep > i
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={!unlocked}
              className={`step-rail-item ${on ? 'is-on' : ''} ${done ? 'is-done' : ''}`}
              onClick={() => goToStep(s)}
            >
              <span className="step-rail-dot" />
              <span className="step-rail-label">{bo.modules[STEP_LABELS[s]]}</span>
            </button>
          )
        })}
      </div>

      {step === 'intro' && (
        <section className="panel lesson-step lesson-stage lesson-step-enter">
          <div className="lesson-intro-badge">{bo.modules.wordsReady}</div>
          <p className="module-eyebrow">01</p>
          <h2>{bo.modules.readyBegin}</h2>
          <p className="lesson-intro-count">
            <strong dir="ltr">{words.length}</strong> {bo.modules.wordsCount}
          </p>
          <button
            type="button"
            className="btn btn-primary path-cta-pulse lesson-start-btn"
            onClick={() => {
              unlockAudio()
              advance('words')
            }}
          >
            {bo.modules.startLesson}
          </button>
        </section>
      )}

      {step === 'words' && (
        <section className="panel lesson-step lesson-step-enter">
          <p className="module-eyebrow">02</p>
          <h2>{bo.modules.meetVocab}</h2>
          <p className="muted">
            {bo.modules.tapFlip} · {bo.modules.heard} {wordsHeard}/{words.length}
          </p>
          <div className="flip-grid">
            {words.map((w) => {
              const isFlip = flipped[w.id]
              const isHeard = heard[w.id]
              return (
                <div key={w.id} className={`flip-card ${isFlip ? 'is-flipped' : ''} ${isHeard ? 'is-heard' : ''}`}>
                  <button type="button" className="flip-face flip-front" onClick={() => flipCard(w.id)}>
                    <span className="tibetan flip-bo">{w.tibetan}</span>
                    <span className="muted flip-hint">{bo.modules.tapFlip}</span>
                  </button>
                  <div className="flip-face flip-back">
                    <button type="button" className="flip-back-main" onClick={() => flipCard(w.id)}>
                      {w.english && <div className="flip-en" dir="ltr">{w.english}</div>}
                      {w.wylie && (
                        <div className="muted flip-wylie" dir="ltr">
                          {w.wylie}
                        </div>
                      )}
                      {w.example && (
                        <div className="flip-example tibetan">{w.example}</div>
                      )}
                      {w.example_en && (
                        <div className="muted flip-example-en" dir="ltr">
                          {w.example_en}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-accent flip-speak"
                      onClick={() => onSpeak(w.tibetan, w.id)}
                    >
                      {bo.modules.tapSpeak}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <NavRow onPrev={prev} onNext={() => advance('dialogue')} />
        </section>
      )}

      {step === 'dialogue' && (
        <section className="panel lesson-step lesson-step-enter">
          <p className="module-eyebrow">03</p>
          <h2>{bo.modules.readAlong}</h2>
          <div className="dialogue-play-head">
            <button type="button" className="btn btn-ghost" onClick={playDialogueAll}>
              {bo.modules.playAllLines}
            </button>
            <span className="meta" dir="ltr">
              {Math.min(dialogueIdx + 1, dialogue.length)}/{dialogue.length}
            </span>
          </div>
          <div className="dialogue-list dialogue-reveal">
            {dialogue.map((line, i) => {
              if (i > dialogueIdx) return null
              const visible = i <= dialogueIdx
              const enOn = showEn[i]
              return (
                <div
                  key={i}
                  className={`dialogue-line lesson-step-enter ${line.speaker === 'B' ? 'is-b' : ''} ${visible ? 'is-show' : ''}`}
                >
                  <div className="dialogue-speaker">{line.speaker}</div>
                  <div className="dialogue-bubble">
                    <button
                      type="button"
                      className="dialogue-speak-btn"
                      onClick={() => onSpeak(line.tibetan)}
                    >
                      <div className="tibetan" style={{ fontSize: '1.35rem', color: 'var(--teal-mid)' }}>
                        {line.tibetan}
                      </div>
                    </button>
                    {line.wylie && (
                      <div className="muted" dir="ltr" style={{ fontStyle: 'italic' }}>
                        {line.wylie}
                      </div>
                    )}
                    {enOn ? (
                      <div dir="ltr">{line.english}</div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost dialogue-en-btn"
                        onClick={() => setShowEn((s) => ({ ...s, [i]: true }))}
                      >
                        {bo.modules.revealEnglish}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="module-actions" style={{ marginTop: 20, justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={prev}>
              {bo.modules.back}
            </button>
            {dialogueIdx < dialogue.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDialogueIdx((d) => d + 1)}
              >
                {bo.modules.nextLine}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => advance('notes')}>
                {bo.modules.continue}
              </button>
            )}
          </div>
        </section>
      )}

      {step === 'notes' && (
        <section className="panel lesson-step lesson-step-enter">
          <p className="module-eyebrow">04</p>
          <h2>{bo.modules.closerLook}</h2>
          <p className="muted">{bo.modules.tapReveal}</p>
          <div className="notes-reveal-grid">
            {(notesChunks.length ? notesChunks : [bo.modules.closerLook]).map((chunk, i) => {
              const on = revealedNotes[i]
              return (
                <button
                  key={i}
                  type="button"
                  className={`notes-chip ${on ? 'is-on' : ''}`}
                  onClick={() => setRevealedNotes((r) => ({ ...r, [i]: true }))}
                >
                  {on ? chunk : bo.modules.tapReveal}
                </button>
              )
            })}
          </div>
          <NavRow onPrev={prev} onNext={() => advance('quiz')} nextLabel={bo.modules.takeQuiz} />
        </section>
      )}

      {step === 'quiz' && (
        <section className="panel lesson-step lesson-step-enter">
          <p className="module-eyebrow">05</p>
          <h2>{bo.modules.checkUnderstanding}</h2>
          <p className="quiz-live-score">
            {bo.modules.scoreLive}:{' '}
            <strong dir="ltr">
              {liveScore}/{quiz.length}
            </strong>
          </p>
          <div className="quiz-list">
            {quiz.map((q, i) => {
              const picked = answers[i]
              const isLocked = locked[i]
              return (
                <div key={i} className="quiz-q">
                  <div className="quiz-q-prompt">
                    <span className="quiz-q-num" dir="ltr">
                      {i + 1}.
                    </span>{' '}
                    <QuizPrompt text={q.q} highlight={q.highlight} />
                  </div>
                  <div className="quiz-opts">
                    {(q.options || []).map((opt, j) => {
                      let cls = 'quiz-opt'
                      if (isLocked) {
                        if (j === q.answer) cls += ' is-correct'
                        else if (picked === j) cls += ' is-wrong'
                      } else if (picked === j) {
                        cls += ' is-selected'
                      }
                      return (
                        <button
                          key={j}
                          type="button"
                          className={cls}
                          disabled={isLocked}
                          onClick={() => onPickAnswer(i, j)}
                        >
                          <span dir="ltr">{String.fromCharCode(65 + j)}.</span>{' '}
                          {tibetanOrFallback(opt, opt)}
                        </button>
                      )
                    })}
                  </div>
                  {isLocked && (
                    <p className={`quiz-feedback ${picked === q.answer ? 'ok' : 'bad'}`}>
                      {picked === q.answer ? bo.modules.correct : bo.modules.tryAgain}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <div className="module-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={prev}>
              {bo.modules.back}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!allQuizAnswered}
              onClick={onSubmitQuiz}
            >
              {bo.modules.submitAnswers}
            </button>
          </div>
        </section>
      )}

      {step === 'done' && quizResult && (
        <section className="panel lesson-done lesson-step-enter">
          <div className="tibetan lesson-done-title">ལེགས་སོ།</div>
          <h2>{bo.modules.wellDone}</h2>
          <div className="lesson-stars" aria-label={bo.modules.stars}>
            {[0, 1, 2].map((i) => {
              const threshold = ((i + 1) / 3) * (quizResult.total || 1)
              const on = quizResult.score >= threshold
              return (
                <span key={i} className={`lesson-star ${on ? 'is-on' : ''}`}>
                  ★
                </span>
              )
            })}
          </div>
          <p dir="ltr">
            {quizResult.score} / {quizResult.total} · +{quizResult.score * 10} XP
          </p>
          {quizResult.score >= Math.max(1, Math.floor((quizResult.total || 1) / 2)) && (
            <p className="muted">{bo.learningPath.completed}</p>
          )}
          <div className="module-actions">
            <Link className="btn btn-ghost" to="/learning-path">
              {bo.modules.openPath}
            </Link>
            <Link className="btn btn-accent" to="/lessons">
              {bo.modules.backLessons}
            </Link>
            <Link className="btn btn-primary" to="/tutor">
              {bo.modules.goTutor}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

function NavRow({ onPrev, onNext, nextLabel }) {
  return (
    <div className="module-actions" style={{ marginTop: 20, justifyContent: 'space-between' }}>
      <button type="button" className="btn btn-ghost" onClick={onPrev}>
        {bo.modules.back}
      </button>
      <button type="button" className="btn btn-primary" onClick={onNext}>
        {nextLabel || bo.modules.continue}
      </button>
    </div>
  )
}

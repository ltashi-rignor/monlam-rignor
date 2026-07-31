import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, clearApiCache } from '../api/client'
import { useModuleProgress } from '../hooks/useModuleProgress'
import { bo } from '../i18n/bo'
import { tibetanOrFallback } from '../i18n/labels'

const STEPS = ['intro', 'words', 'dialogue', 'notes', 'quiz', 'done']

export default function LessonDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { submitQuiz } = useModuleProgress()
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState('intro')
  const [answers, setAnswers] = useState({})
  const [quizResult, setQuizResult] = useState(null)
  const [regenBusy, setRegenBusy] = useState(false)

  async function load(regenerate = false) {
    setLoading(true)
    setError('')
    try {
      const data = regenerate
        ? await api.regenerateInteractiveLesson(id)
        : await api.getInteractiveLesson(id)
      setLesson(data)
      setStep('intro')
      setAnswers({})
      setQuizResult(null)
      clearApiCache('GET:/api/modules/lessons')
    } catch (err) {
      setError(err.message)
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

  if (loading) {
    return (
      <div className="empty panel tibetan">
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

  const next = () => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }
  const prev = () => {
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  async function onSubmitQuiz() {
    let score = 0
    ;(lesson.quiz || []).forEach((q, i) => {
      if (answers[i] === q.answer) score += 1
    })
    const total = lesson.quiz?.length || 0
    setQuizResult({ score, total })
    try {
      await submitQuiz(lesson.id, score, total || 1)
    } catch {
      /* ignore */
    }
    setStep('done')
  }

  const stepIndex = STEPS.indexOf(step)
  const title = tibetanOrFallback(lesson.tibetan_title || lesson.title, lesson.title)
  const focus = tibetanOrFallback(lesson.focus, '')
  const notes = tibetanOrFallback(lesson.notes, lesson.notes || '')

  return (
    <div className="module-page lesson-detail-page tibetan">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/lessons')}>
          ← {bo.modules.backLessons}
        </button>
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

      <header className="page-header" style={{ marginTop: 4 }}>
        <div>
          <p className="module-eyebrow">
            {bo.learningPath.week} {lesson.week_number}
            {lesson.level ? ` · ${tibetanOrFallback(lesson.level, lesson.level)}` : ''} ·{' '}
            <span dir="ltr">{lesson.minutes} min</span>
          </p>
          <h1>{title}</h1>
          {focus && <p className="muted">{focus}</p>}
        </div>
      </header>

      <div className="step-dots">
        {STEPS.slice(0, 5).map((s, i) => (
          <div key={s} className={`step-dot ${stepIndex >= i ? 'is-on' : ''}`} />
        ))}
      </div>

      {step === 'intro' && (
        <section className="panel lesson-step">
          <p className="module-eyebrow">01</p>
          <h2>{bo.modules.readyBegin}</h2>
          <p>
            {bo.modules.lessonIntroHint} {words.length} {bo.modules.wordsCount}
          </p>
          <button type="button" className="btn btn-primary" onClick={next}>
            {bo.modules.startLesson}
          </button>
        </section>
      )}

      {step === 'words' && (
        <section className="panel lesson-step">
          <p className="module-eyebrow">02</p>
          <h2>{bo.modules.meetVocab}</h2>
          <div className="grid-2" style={{ gap: 12, marginTop: 16 }}>
            {words.map((w) => (
              <div key={w.id} className="vocab-card">
                <div className="tibetan" style={{ fontSize: '1.5rem', color: 'var(--teal-mid)' }}>
                  {w.tibetan}
                </div>
                {w.wylie && (
                  <div className="muted" dir="ltr" style={{ fontSize: '0.85rem' }}>
                    {w.wylie}
                  </div>
                )}
                {w.english && <div dir="ltr">{w.english}</div>}
              </div>
            ))}
          </div>
          <NavRow onPrev={prev} onNext={next} />
        </section>
      )}

      {step === 'dialogue' && (
        <section className="panel lesson-step">
          <p className="module-eyebrow">03</p>
          <h2>{bo.modules.readAlong}</h2>
          <div className="dialogue-list">
            {(lesson.dialogue || []).map((line, i) => (
              <div key={i} className={`dialogue-line ${line.speaker === 'B' ? 'is-b' : ''}`}>
                <div className="dialogue-speaker">{line.speaker}</div>
                <div className="dialogue-bubble">
                  <div className="tibetan" style={{ fontSize: '1.35rem', color: 'var(--teal-mid)' }}>
                    {line.tibetan}
                  </div>
                  {line.wylie && (
                    <div className="muted" dir="ltr" style={{ fontStyle: 'italic' }}>
                      {line.wylie}
                    </div>
                  )}
                  {line.english && <div dir="ltr">{line.english}</div>}
                </div>
              </div>
            ))}
          </div>
          <NavRow onPrev={prev} onNext={next} />
        </section>
      )}

      {step === 'notes' && (
        <section className="panel lesson-step">
          <p className="module-eyebrow">04</p>
          <h2>{bo.modules.closerLook}</h2>
          <p className="lesson-notes">{notes}</p>
          <NavRow onPrev={prev} onNext={next} nextLabel={bo.modules.takeQuiz} />
        </section>
      )}

      {step === 'quiz' && (
        <section className="panel lesson-step">
          <p className="module-eyebrow">05</p>
          <h2>{bo.modules.checkUnderstanding}</h2>
          <div className="quiz-list">
            {(lesson.quiz || []).map((q, i) => (
              <div key={i} className="quiz-q">
                <div style={{ fontWeight: 600 }}>
                  {i + 1}. {tibetanOrFallback(q.q, q.q)}
                </div>
                <div className="quiz-opts">
                  {(q.options || []).map((opt, j) => (
                    <button
                      key={j}
                      type="button"
                      className={`quiz-opt ${answers[i] === j ? 'is-selected' : ''}`}
                      onClick={() => setAnswers({ ...answers, [i]: j })}
                    >
                      <span dir="ltr">{String.fromCharCode(65 + j)}.</span>{' '}
                      {tibetanOrFallback(opt, opt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="module-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={prev}>
              {bo.modules.back}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={Object.keys(answers).length < (lesson.quiz?.length || 0)}
              onClick={onSubmitQuiz}
            >
              {bo.modules.submitAnswers}
            </button>
          </div>
        </section>
      )}

      {step === 'done' && quizResult && (
        <section className="panel lesson-done">
          <div className="tibetan" style={{ fontSize: '2rem' }}>
            ལེགས་སོ།
          </div>
          <h2>{bo.modules.wellDone}</h2>
          <p dir="ltr">
            Score: {quizResult.score} / {quizResult.total} · +{quizResult.score * 10} XP
          </p>
          <div className="module-actions">
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

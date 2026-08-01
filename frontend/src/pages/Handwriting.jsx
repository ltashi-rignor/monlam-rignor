/**
 * Handwriting — TraceCore practice UI (KharagEdition stroke data).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONSONANTS } from '../data/tibetan'
import { getStrokeLesson } from '../data/strokeLessons'
import traceDoc from '../data/tibetanTraceLetters.json'
import { normalizeDoc, normalizeBrush, TraceEngine } from '../lib/traceCore'
import { useI18n } from '../i18n/useI18n'

const TRACE_LETTERS = normalizeDoc(traceDoc)
const TRACE_BRUSH = normalizeBrush(traceDoc.brush)
const BY_GLYPH = Object.fromEntries(TRACE_LETTERS.map((L) => [L.glyph, L]))

function indexForGlyph(glyph) {
  const i = TRACE_LETTERS.findIndex((L) => L.glyph === glyph)
  return i >= 0 ? i : 0
}

export default function Handwriting() {
  const { t } = useI18n()

  const [idx, setIdx] = useState(0)
  const [strokeI, setStrokeI] = useState(0)
  const [strokeN, setStrokeN] = useState(1)
  const [finished, setFinished] = useState(false)
  const [ready, setReady] = useState(false)
  const [demoing, setDemoing] = useState(false)

  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const wrapRef = useRef(null)

  const letter = CONSONANTS[idx]
  const lesson = useMemo(() => getStrokeLesson(letter.id), [letter.id])
  const traceLetter = BY_GLYPH[letter.letter] || TRACE_LETTERS[indexForGlyph(letter.letter)]
  const tip = lesson.steps[Math.min(strokeI, Math.max(0, lesson.steps.length - 1))]
  const stepLabel = finished
    ? t.modules.handLetterDone
    : `${t.modules.handStroke} ${Math.min(strokeI + 1, strokeN)}/${strokeN}`

  const fit = useCallback(() => {
    const engine = engineRef.current
    const wrap = wrapRef.current
    if (!engine || !wrap) return
    // Size drawing buffer from the square stage frame (CSS owns the box)
    const rect = wrap.getBoundingClientRect()
    const pad = 16
    const side = Math.max(220, Math.floor(Math.min(rect.width, rect.height) - pad))
    engine.resize(side)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const engine = new TraceEngine(canvas, {
      sfx: false,
      haptics: true,
      ghost: 'rgba(13, 61, 69, 0.14)',
      accent: '#c47a16',
      inkFrom: '#1a6b76',
      inkTo: '#0d3d45',
      guide: 'rgba(7, 22, 26, 0.38)',
      onStrokeChange: (si, total, done) => {
        setStrokeI(Math.min(si, Math.max(0, total - 1)))
        setStrokeN(total)
        setFinished(!!done)
        if (!done) setDemoing(false)
      },
      onComplete: () => {
        setFinished(true)
        setDemoing(false)
      },
    })
    engine.setBrush(TRACE_BRUSH)
    engineRef.current = engine
    setReady(true)
    fit()
    const onResize = () => fit()
    window.addEventListener('resize', onResize)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null
    if (ro && wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [fit])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !traceLetter) return
    engine.setLetter(traceLetter)
    setStrokeI(0)
    setStrokeN(traceLetter.strokes.length)
    setFinished(false)
    setDemoing(false)
    fit()
  }, [letter.letter, traceLetter, fit])

  const goLetter = (delta) => {
    setIdx((i) => (i + delta + CONSONANTS.length) % CONSONANTS.length)
  }

  const reset = () => {
    engineRef.current?.reset()
    setFinished(false)
    setStrokeI(0)
    setDemoing(false)
  }

  const playDemo = () => {
    setDemoing(true)
    setFinished(false)
    engineRef.current?.demo()
  }

  return (
    <div className="module-page tibetan hand-page">
      <header className="hand-page-header">
        <div className="hand-page-heading">
          <p className="module-eyebrow">{t.modules.handEyebrow}</p>
          <h1>{t.modules.handTitle}</h1>
        </div>
        <p className="hand-page-sub" dir="ltr">
          Trace each stroke · watch the demo when you need help
        </p>
      </header>

      <div className="hand-studio">
        <section className="hand-practice" aria-label="Practice">
          <div className="hand-identity">
            <div key={letter.letter} className="hand-identity-glyph tibetan">
              {letter.letter}
            </div>
            <div className="hand-identity-meta">
              <p className="hand-identity-wylie" dir="ltr">
                {letter.wylie}
              </p>
              <p className="hand-identity-count" dir="ltr">
                {idx + 1} / {CONSONANTS.length}
              </p>
              <p className="hand-identity-step">{stepLabel}</p>
            </div>
          </div>

          <div className="hand-strokebar" aria-hidden>
            {Array.from({ length: strokeN }, (_, k) => (
              <span
                key={k}
                className={
                  'hand-sdot' +
                  (finished || k < strokeI ? ' is-done' : k === strokeI ? ' is-now' : '')
                }
              />
            ))}
          </div>

          <div
            className={'hand-stage' + (finished ? ' is-done' : '') + (demoing ? ' is-demo' : '')}
            ref={wrapRef}
          >
            <canvas
              ref={canvasRef}
              className="hand-trace-canvas"
              aria-label={`${letter.letter} handwriting practice`}
            />
            {!ready && <p className="muted hand-loading">…</p>}
          </div>

          <p className="hand-trace-hint">
            {finished
              ? t.modules.handLetterDone
              : demoing
                ? t.modules.handReplay
                : t.modules.handDrawPrompt}
          </p>

          <div className="hand-toolbar">
            <button type="button" className="btn btn-ghost" onClick={reset}>
              {t.modules.handRestart}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={playDemo}
              disabled={!ready}
            >
              {t.modules.handReplay}
            </button>
            <div className="hand-toolbar-nav">
              <button type="button" className="btn btn-ghost" onClick={() => goLetter(-1)}>
                {t.modules.handPrevLetter}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => goLetter(1)}>
                {t.modules.nextLetter}
              </button>
            </div>
          </div>
        </section>

        <aside className="hand-coach" aria-label="Stroke guide">
          <p className="hand-coach-label">{t.modules.fynnDiagram}</p>
          <a
            className="hand-fynn-link"
            href="https://sites.google.com/view/chrisfynn/home/tibetanscriptfonts/howtowritethetibetanscript"
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="hand-fynn-img"
              src={lesson.image}
              alt=""
              key={lesson.image}
            />
          </a>

          <div className="hand-coach-tip">
            <p className="module-eyebrow">{stepLabel}</p>
            <p className="hand-tip-bo">
              {finished ? t.modules.handPracticeTip : tip?.bo || t.modules.handDrawPrompt}
            </p>
            <p className="hand-tip-en" dir="ltr">
              {finished ? t.modules.handPracticeTipEn : tip?.en || ''}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Compact one-letter trace pad for the Alphabet letter ritual.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import traceDoc from '../data/tibetanTraceLetters.json'
import { normalizeDoc, normalizeBrush, TraceEngine } from '../lib/traceCore'
import { bo } from '../i18n/bo'

const TRACE_LETTERS = normalizeDoc(traceDoc)
const TRACE_BRUSH = normalizeBrush(traceDoc.brush)
const BY_GLYPH = Object.fromEntries(TRACE_LETTERS.map((L) => [L.glyph, L]))

export default function LetterMiniTrace({ glyph, onComplete }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const engineRef = useRef(null)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const [finished, setFinished] = useState(false)
  const [strokeI, setStrokeI] = useState(0)
  const [strokeN, setStrokeN] = useState(1)

  const traceLetter = BY_GLYPH[glyph] || TRACE_LETTERS[0]

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const fit = useCallback(() => {
    const engine = engineRef.current
    const wrap = wrapRef.current
    if (!engine || !wrap) return
    // Size buffer from the square content box (padding already inset)
    const rect = wrap.getBoundingClientRect()
    const style = getComputedStyle(wrap)
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
    const side = Math.max(
      200,
      Math.floor(Math.min(rect.width - padX, rect.height - padY)),
    )
    engine.resize(side)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    doneRef.current = false
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
        if (done && !doneRef.current) {
          doneRef.current = true
          onCompleteRef.current?.()
        }
      },
      onComplete: () => {
        setFinished(true)
        if (!doneRef.current) {
          doneRef.current = true
          onCompleteRef.current?.()
        }
      },
    })
    engine.setBrush(TRACE_BRUSH)
    engineRef.current = engine
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
    doneRef.current = false
    engine.setLetter(traceLetter)
    setStrokeI(0)
    setStrokeN(traceLetter.strokes.length)
    setFinished(false)
    fit()
  }, [glyph, traceLetter, fit])

  if (!traceLetter) {
    return <p className="muted">{bo.modules.alphaNoTrace}</p>
  }

  return (
    <div className="alpha-mini-trace">
      <div className="alpha-mini-trace-bar" aria-hidden>
        {Array.from({ length: strokeN }, (_, k) => (
          <span
            key={k}
            className={
              'alpha-mini-dot' +
              (finished || k < strokeI ? ' is-done' : k === strokeI ? ' is-now' : '')
            }
          />
        ))}
      </div>
      <div ref={wrapRef} className={`alpha-mini-stage ${finished ? 'is-done' : ''}`}>
        <canvas ref={canvasRef} className="alpha-mini-canvas" />
      </div>
      <div className="alpha-mini-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            doneRef.current = false
            setFinished(false)
            engineRef.current?.reset()
          }}
        >
          {bo.modules.alphaRetryTrace}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setFinished(false)
            engineRef.current?.demo()
          }}
        >
          {bo.modules.alphaWatchDemo}
        </button>
      </div>
    </div>
  )
}

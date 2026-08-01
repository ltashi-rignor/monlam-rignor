/**
 * Compact one-letter trace pad for the Alphabet letter ritual.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { TraceEngine } from '../lib/traceCore'
import { loadTraceData } from '../lib/loadTraceData'
import { useI18n } from '../i18n/useI18n'

export default function LetterMiniTrace({ glyph, onComplete }) {
  const { t } = useI18n()

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const engineRef = useRef(null)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const [finished, setFinished] = useState(false)
  const [strokeI, setStrokeI] = useState(0)
  const [strokeN, setStrokeN] = useState(1)
  const [traceLetter, setTraceLetter] = useState(null)
  const [brush, setBrush] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    loadTraceData()
      .then((data) => {
        if (cancelled) return
        setBrush(data.brush)
        setTraceLetter(data.byGlyph[glyph] || data.letters[0] || null)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [glyph])

  const fit = useCallback(() => {
    const engine = engineRef.current
    const wrap = wrapRef.current
    if (!engine || !wrap) return
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
    if (!canvas || !brush) return undefined
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
    engine.setBrush(brush)
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
  }, [fit, brush])

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

  if (loadError) {
    return <p className="muted">{t.modules.alphaNoTrace}</p>
  }
  if (!traceLetter || !brush) {
    return <p className="muted">…</p>
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
          {t.modules.alphaRetryTrace}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setFinished(false)
            engineRef.current?.demo()
          }}
        >
          {t.modules.alphaWatchDemo}
        </button>
      </div>
    </div>
  )
}

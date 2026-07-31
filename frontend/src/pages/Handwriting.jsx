import { useEffect, useRef, useState } from 'react'
import { CONSONANTS } from '../data/tibetan'
import { bo } from '../i18n/bo'

export default function Handwriting() {
  const [idx, setIdx] = useState(0)
  const [showGuide, setShowGuide] = useState(true)
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const strokes = useRef([])
  const current = useRef([])

  const letter = CONSONANTS[idx]

  const redraw = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = c.width / dpr
    const h = c.height / dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (showGuide) {
      ctx.fillStyle = 'rgba(26, 107, 118, 0.12)'
      ctx.font = `${Math.floor(h * 0.72)}px "Monlam Uni OuChan2", "Noto Serif Tibetan", serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter.letter, w / 2, h / 2 + 8)
    }

    ctx.strokeStyle = '#07161a'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokes.current) {
      if (s.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(s[0].x, s[0].y)
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y)
      ctx.stroke()
    }
    if (current.current.length > 1) {
      ctx.beginPath()
      ctx.moveTo(current.current[0].x, current.current[0].y)
      for (let i = 1; i < current.current.length; i++) {
        ctx.lineTo(current.current[i].x, current.current[i].y)
      }
      ctx.stroke()
    }
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.parentElement.getBoundingClientRect()
    const size = Math.min(560, Math.max(240, Math.floor(rect.width) - 8))
    c.width = size * dpr
    c.height = size * dpr
    c.style.width = `${size}px`
    c.style.height = `${size}px`
    strokes.current = []
    current.current = []
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  useEffect(() => {
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGuide])

  const pos = (e) => {
    const c = canvasRef.current
    const rect = c.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - rect.left, y: t.clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    current.current = [pos(e)]
  }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    current.current.push(pos(e))
    redraw()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (current.current.length > 1) strokes.current.push(current.current)
    current.current = []
    redraw()
  }

  const clearAll = () => {
    strokes.current = []
    current.current = []
    redraw()
  }
  const undo = () => {
    strokes.current.pop()
    redraw()
  }
  const nextLetter = () => setIdx((i) => (i + 1) % CONSONANTS.length)

  return (
    <div className="module-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{bo.modules.handEyebrow}</p>
          <h1>{bo.modules.handTitle}</h1>
          <p>{bo.modules.handSub}</p>
        </div>
      </header>

      <div className="handwriting-layout">
        <div>
          <p className="muted" dir="ltr">
            {letter.wylie} · {letter.group}
          </p>
          <div className="panel handwriting-canvas-wrap">
            <canvas
              ref={canvasRef}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
              className="handwriting-canvas"
            />
          </div>
        </div>

        <aside className="panel handwriting-aside">
          <p className="muted">{bo.modules.reference}</p>
          <div className="hand-ref-letter tibetan">{letter.letter}</div>
          <div dir="ltr" style={{ fontSize: '1.4rem', marginTop: 8 }}>
            {letter.latin}
          </div>

          <label className="hand-toggle">
            <span>{bo.modules.showGuide}</span>
            <input
              type="checkbox"
              checked={showGuide}
              onChange={(e) => setShowGuide(e.target.checked)}
            />
          </label>

          <div className="module-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={undo}>
              {bo.modules.undo}
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearAll}>
              {bo.modules.clear}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              clearAll()
              nextLetter()
            }}
          >
            {bo.modules.nextLetter}
          </button>
        </aside>
      </div>
    </div>
  )
}

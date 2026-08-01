import { useEffect, useState } from 'react'

/**
 * Staged progress while a long async job runs (grammar, lessons, path).
 * Advances stage labels on a timer and eases a bar toward ~92% until done.
 */
export default function WorkingProgress({
  active,
  stages = [],
  title,
  compact = false,
  intervalMs = 2600,
}) {
  const [stage, setStage] = useState(0)
  const [pct, setPct] = useState(10)

  useEffect(() => {
    if (!active) {
      setStage(0)
      setPct(10)
      return undefined
    }
    setStage(0)
    setPct(14)
    const last = Math.max(0, stages.length - 1)
    const stageTimer = window.setInterval(() => {
      setStage((s) => Math.min(s + 1, last))
    }, intervalMs)
    const barTimer = window.setInterval(() => {
      setPct((p) => {
        if (p >= 92) return p
        const step = p < 35 ? 5 : p < 65 ? 2.8 : 1.1
        return Math.min(92, p + step)
      })
    }, 380)
    return () => {
      window.clearInterval(stageTimer)
      window.clearInterval(barTimer)
    }
  }, [active, stages.length, intervalMs])

  if (!active) return null

  const safeStages = stages.length ? stages : [title].filter(Boolean)
  const label = safeStages[Math.min(stage, safeStages.length - 1)] || title || ''

  return (
    <div
      className={`working-progress ${compact ? 'is-compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {!compact && <div className="working-progress-shimmer" aria-hidden />}
      <div className="working-progress-body">
        {title ? <p className="working-progress-title">{title}</p> : null}
        <p className="working-progress-stage">{label}</p>
        <div className="working-progress-track" aria-hidden>
          <div className="working-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {!compact && safeStages.length > 1 ? (
          <ol className="working-progress-steps">
            {safeStages.map((s, i) => (
              <li
                key={`${i}-${s}`}
                className={i < stage ? 'is-done' : i === stage ? 'is-active' : ''}
              >
                {s}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  )
}

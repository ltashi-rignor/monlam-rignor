import { useEffect, useState } from 'react'

/**
 * Indeterminate progress while a long async job runs.
 * Stages rotate for status copy; the bar pulses (not a fake %) so UX stays honest.
 */
export default function WorkingProgress({
  active,
  stages = [],
  title,
  compact = false,
  intervalMs = 2600,
}) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!active) {
      setStage(0)
      return undefined
    }
    setStage(0)
    const last = Math.max(0, stages.length - 1)
    const stageTimer = window.setInterval(() => {
      setStage((s) => Math.min(s + 1, last))
    }, intervalMs)
    return () => window.clearInterval(stageTimer)
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
        <div className="working-progress-track is-indeterminate" aria-hidden>
          <div className="working-progress-fill" />
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

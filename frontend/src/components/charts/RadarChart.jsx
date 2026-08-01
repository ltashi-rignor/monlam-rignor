import { useMemo } from 'react'
import { polarToCartesian } from './chartUtils'

/**
 * @param {{
 *   skills: { key: string, label: string, value: number }[]
 *   emptyLabel?: string
 * }} props
 */
export default function RadarChart({ skills = [], emptyLabel = '—' }) {
  const items = useMemo(
    () =>
      (skills || []).map((s) => ({
        ...s,
        value: Math.max(0, Math.min(100, Number(s.value) || 0)),
      })),
    [skills],
  )

  if (!items.length) {
    return <p className="chart-empty">{emptyLabel}</p>
  }

  const size = 260
  const cx = size / 2
  const cy = size / 2 + 4
  const radius = 78
  const n = items.length
  const angleStep = 360 / n

  const rings = [0.25, 0.5, 0.75, 1]
  const gridPolys = rings.map((r) =>
    items
      .map((_, i) => {
        const p = polarToCartesian(cx, cy, radius * r, i * angleStep)
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      })
      .join(' '),
  )

  const valuePoints = items.map((s, i) =>
    polarToCartesian(cx, cy, (radius * s.value) / 100, i * angleStep),
  )
  const valuePoly = valuePoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="chart-wrap chart-radar">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Skills radar" className="chart-svg">
        {gridPolys.map((pts, i) => (
          <polygon key={i} className="chart-radar-grid" points={pts} />
        ))}
        {items.map((_, i) => {
          const tip = polarToCartesian(cx, cy, radius, i * angleStep)
          return (
            <line
              key={`axis-${i}`}
              className="chart-radar-axis"
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
            />
          )
        })}
        <polygon className="chart-radar-fill" points={valuePoly} />
        <polygon className="chart-radar-stroke" points={valuePoly} fill="none" />
        {valuePoints.map((p, i) => (
          <circle key={`dot-${i}`} className="chart-radar-dot" cx={p.x} cy={p.y} r={3.5} />
        ))}
        {items.map((s, i) => {
          const labelPos = polarToCartesian(cx, cy, radius + 28, i * angleStep)
          return (
            <text
              key={s.key}
              className="chart-radar-label"
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.label}
              <tspan className="chart-radar-score" x={labelPos.x} dy="1.15em" dir="ltr">
                {Math.round(s.value)}
              </tspan>
            </text>
          )
        })}
      </svg>
    </div>
  )
}

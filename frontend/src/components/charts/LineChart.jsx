import { useId, useMemo, useState } from 'react'
import { formatShortDate, niceMax } from './chartUtils'

/**
 * @param {{
 *   points: { label?: string, date?: string, value: number }[]
 *   emptyLabel?: string
 *   isEn?: boolean
 *   valueSuffix?: string
 *   height?: number
 * }} props
 */
export default function LineChart({
  points = [],
  emptyLabel = '—',
  isEn = true,
  valueSuffix = '',
  height = 200,
}) {
  const gradId = useId().replace(/:/g, '')
  const [active, setActive] = useState(null)

  const series = useMemo(
    () =>
      (points || [])
        .map((p, i) => ({
          label: p.label || formatShortDate(p.date, isEn) || String(i + 1),
          value: clampScore(p.value ?? p.score),
          date: p.date,
        }))
        .filter((p) => p.value != null),
    [points, isEn],
  )

  if (!series.length) {
    return <p className="chart-empty">{emptyLabel}</p>
  }

  const W = 420
  const H = height
  const pad = { t: 18, r: 16, b: 32, l: 36 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const yMax = Math.max(100, niceMax(series.map((s) => s.value), 100))
  const xStep = series.length === 1 ? 0 : innerW / (series.length - 1)

  const coords = series.map((s, i) => {
    const x = pad.l + (series.length === 1 ? innerW / 2 : i * xStep)
    const y = pad.t + innerH - (s.value / yMax) * innerH
    return { ...s, x, y }
  })

  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaD = `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`

  const yTicks = [0, 0.5, 1].map((t) => ({
    value: Math.round(yMax * t),
    y: pad.t + innerH * (1 - t),
  }))

  const tip = active != null ? coords[active] : null

  return (
    <div className="chart-wrap chart-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart" className="chart-svg">
        <defs>
          <linearGradient id={`line-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--teal-mid)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--teal-mid)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              className="chart-grid"
              x1={pad.l}
              x2={W - pad.r}
              y1={tick.y}
              y2={tick.y}
            />
            <text className="chart-axis" x={pad.l - 8} y={tick.y + 4} textAnchor="end" dir="ltr">
              {tick.value}
            </text>
          </g>
        ))}

        <path className="chart-area" d={areaD} fill={`url(#line-fill-${gradId})`} />
        <path className="chart-polyline" d={lineD} />

        {coords.map((c, i) => (
          <g key={`${c.label}-${i}`}>
            <circle
              className={`chart-dot${active === i ? ' is-active' : ''}`}
              cx={c.x}
              cy={c.y}
              r={active === i ? 5.5 : 4}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={0}
            />
            {(i === 0 || i === coords.length - 1 || coords.length <= 6 || i % 2 === 0) && (
              <text className="chart-axis chart-x-label" x={c.x} y={H - 10} textAnchor="middle" dir="ltr">
                {c.label}
              </text>
            )}
          </g>
        ))}

        {tip && (
          <g className="chart-tooltip" pointerEvents="none">
            <rect
              x={clamp(tip.x - 34, 4, W - 72)}
              y={Math.max(4, tip.y - 36)}
              width={68}
              height={24}
              rx={6}
            />
            <text
              x={clamp(tip.x, 38, W - 38)}
              y={Math.max(4, tip.y - 36) + 16}
              textAnchor="middle"
              dir="ltr"
            >
              {Math.round(tip.value)}
              {valueSuffix}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function clampScore(v) {
  if (v == null || Number.isNaN(Number(v))) return null
  return clamp(Number(v), 0, 100)
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

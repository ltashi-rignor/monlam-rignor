import { useMemo, useState } from 'react'
import { formatShortDate, niceMax } from './chartUtils'

/**
 * Grouped bars: practices + stories + mistakes per day.
 * @param {{
 *   days: { date: string, practices_completed?: number, stories?: number, essays?: number, mistakes?: number }[]
 *   labels: { practices: string, stories: string, mistakes: string }
 *   emptyLabel?: string
 *   isEn?: boolean
 *   height?: number
 * }} props
 */
export default function BarChart({
  days = [],
  labels,
  emptyLabel = '—',
  isEn = true,
  height = 200,
}) {
  const [active, setActive] = useState(null)

  const series = useMemo(
    () =>
      (days || []).map((d) => ({
        date: d.date,
        label: formatShortDate(d.date, isEn),
        practices: Number(d.practices_completed) || 0,
        stories: Number(d.stories ?? d.essays) || 0,
        mistakes: Number(d.mistakes) || 0,
      })),
    [days, isEn],
  )

  const hasData = series.some((d) => d.practices + d.stories + d.mistakes > 0)
  if (!hasData) {
    return <p className="chart-empty">{emptyLabel}</p>
  }

  const W = 420
  const H = height
  const pad = { t: 16, r: 12, b: 36, l: 32 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const yMax = niceMax(
    series.map((d) => d.practices + d.stories + d.mistakes),
    4,
  )
  const groupW = innerW / series.length
  const barGap = Math.min(4, groupW * 0.12)
  const barW = Math.max(3, (groupW - barGap * 2) / 3)

  const tip = active != null ? series[active] : null

  return (
    <div className="chart-wrap chart-bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart" className="chart-svg">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + innerH * (1 - t)
          const value = Math.round(yMax * t)
          return (
            <g key={t}>
              <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={y} y2={y} />
              <text className="chart-axis" x={pad.l - 6} y={y + 4} textAnchor="end" dir="ltr">
                {value}
              </text>
            </g>
          )
        })}

        {series.map((d, i) => {
          const gx = pad.l + i * groupW + groupW / 2
          const base = pad.t + innerH
          const vals = [
            { key: 'practices', value: d.practices, className: 'chart-bar-practice' },
            { key: 'stories', value: d.stories, className: 'chart-bar-essay' },
            { key: 'mistakes', value: d.mistakes, className: 'chart-bar-mistake' },
          ]
          return (
            <g
              key={d.date}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={active === i ? 'is-active-group' : ''}
            >
              {vals.map((v, vi) => {
                const h = (v.value / yMax) * innerH
                const x = gx - (barW * 3 + barGap * 2) / 2 + vi * (barW + barGap)
                return (
                  <rect
                    key={v.key}
                    className={`chart-bar ${v.className}`}
                    x={x}
                    y={base - h}
                    width={barW}
                    height={Math.max(0, h)}
                    rx={2}
                    style={{ ['--bar-delay']: `${i * 18}ms` }}
                  />
                )
              })}
              {(i === 0 || i === series.length - 1 || i % 3 === 0) && (
                <text className="chart-axis chart-x-label" x={gx} y={H - 10} textAnchor="middle" dir="ltr">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="chart-legend" dir="ltr">
        <span className="chart-legend-item chart-legend-practice">{labels.practices}</span>
        <span className="chart-legend-item chart-legend-essay">{labels.stories}</span>
        <span className="chart-legend-item chart-legend-mistake">{labels.mistakes}</span>
      </div>

      {tip && (
        <div className="chart-tip-caption" dir="ltr">
          {tip.label}: {tip.practices} · {tip.stories} · {tip.mistakes}
        </div>
      )}
    </div>
  )
}

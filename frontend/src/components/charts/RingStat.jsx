/**
 * @param {{ completed: number, total: number, label: string, sublabel?: string }} props
 */
export default function RingStat({ completed = 0, total = 0, label, sublabel }) {
  const safeTotal = Math.max(0, Number(total) || 0)
  const safeDone = Math.max(0, Math.min(safeTotal, Number(completed) || 0))
  const pct = safeTotal > 0 ? safeDone / safeTotal : 0
  const size = 72
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)

  return (
    <div className="ring-stat" aria-label={`${label}: ${safeDone}/${safeTotal}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring-stat-svg">
        <circle
          className="ring-stat-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-stat-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text className="ring-stat-value" x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dir="ltr">
          {safeTotal > 0 ? `${safeDone}/${safeTotal}` : '—'}
        </text>
      </svg>
      <div className="ring-stat-copy">
        <div className="ring-stat-label">{label}</div>
        {sublabel ? <div className="ring-stat-sub">{sublabel}</div> : null}
      </div>
    </div>
  )
}

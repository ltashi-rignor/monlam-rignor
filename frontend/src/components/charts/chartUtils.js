export function formatShortDate(iso, isEn = true) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const day = String(iso).slice(5, 10)
    return day || String(iso)
  }
  if (isEn) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

export function niceMax(values, fallback = 10) {
  const max = Math.max(0, ...values.map((v) => Number(v) || 0))
  if (max <= 0) return fallback
  const padded = max * 1.15
  const magnitude = 10 ** Math.floor(Math.log10(padded))
  return Math.ceil(padded / magnitude) * magnitude
}

export function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

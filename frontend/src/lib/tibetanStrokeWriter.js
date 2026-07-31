/**
 * Tibetan stroke writer — teaching UX modeled on HanziGuide / Hanzi Writer:
 * https://github.com/chanind/hanzi-writer (used by hanziguide-main)
 *
 * - Faint character outline
 * - Stroke-by-stroke reveal along medians (SVG dashoffset = “ink fill”)
 * - Optional quiz: user draws next stroke, matched against the median
 */

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export function pathLength(points) {
  let n = 0
  for (let i = 1; i < points.length; i++) n += dist(points[i - 1], points[i])
  return n
}

export function pointsToPathD(points) {
  if (!points?.length) return ''
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) d += ` L ${points[i][0]} ${points[i][1]}`
  return d
}

/** Map lesson 0–100 coords into writer viewBox (default 0–100). */
export function lessonToWriterChar(lesson) {
  return {
    strokeCount: lesson.steps.length,
    medians: lesson.steps.map((s) => s.path.map(([x, y]) => [x, y])),
    tips: lesson.steps.map((s) => ({ bo: s.bo, en: s.en })),
    image: lesson.image,
  }
}

/**
 * Average distance from user polyline to median, normalized by median length.
 * Lower is better. Also checks rough direction agreement.
 */
export function scoreStrokeMatch(userPts, median, size = 100) {
  if (!userPts?.length || userPts.length < 2 || !median?.length) {
    return { ok: false, score: 1 }
  }
  const medLen = pathLength(median) || 1
  let sum = 0
  for (const p of userPts) {
    let best = Infinity
    for (let i = 1; i < median.length; i++) {
      best = Math.min(best, pointSegDist(p, median[i - 1], median[i]))
    }
    best = Math.min(best, dist(p, median[0]), dist(p, median[median.length - 1]))
    sum += best
  }
  const avg = sum / userPts.length
  const startOk = dist(userPts[0], median[0]) < size * 0.28
  const endOk = dist(userPts[userPts.length - 1], median[median.length - 1]) < size * 0.32
  const userVec = [
    userPts[userPts.length - 1][0] - userPts[0][0],
    userPts[userPts.length - 1][1] - userPts[0][1],
  ]
  const medVec = [
    median[median.length - 1][0] - median[0][0],
    median[median.length - 1][1] - median[0][1],
  ]
  const dot = userVec[0] * medVec[0] + userVec[1] * medVec[1]
  const dirOk = dot >= 0 || Math.hypot(...medVec) < size * 0.08
  const threshold = Math.max(10, medLen * 0.22)
  const ok = avg < threshold && startOk && (endOk || avg < threshold * 0.7) && dirOk
  return { ok, score: avg / size }
}

function pointSegDist(p, a, b) {
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const len2 = vx * vx + vy * vy || 1
  let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  return dist(p, [a[0] + vx * t, a[1] + vy * t])
}

export const WRITER_COLORS = {
  outline: 'rgba(26, 107, 118, 0.16)',
  stroke: '#1a6b76',
  active: '#c47a16',
  hint: 'rgba(196, 122, 22, 0.45)',
  grid: 'rgba(180, 100, 100, 0.35)',
  ink: '#07161a',
}

/** Per-stroke fill colors for the character ink. */
export const STROKE_FILL_COLORS = [
  '#c47a16',
  '#1a6b76',
  '#8b4513',
  '#2d6a4f',
  '#9b2226',
  '#5c4d7a',
  '#b5651d',
]

/** Brush width in viewBox units — wide enough to cover Monlam Uchen glyph ink. */
export const GLYPH_BRUSH = 24

/**
 * Convert Monlam stroke lessons into Hanzi Writer character data.
 * Format matches https://github.com/chanind/hanzi-writer-data
 * (used by hanziguide-main).
 *
 * strokes: SVG path strings (filled outlines of each stroke)
 * medians: centerline polylines in the same 1024-space
 */

import { STROKE_LESSONS, getStrokeLesson } from './strokeLessons'

const BOX = 1024
const PAD = 80
const INNER = BOX - PAD * 2

/** Lesson 0–100 (y down) → Hanzi Writer space (y up). */
function mapPt([x, y]) {
  return [PAD + (x / 100) * INNER, PAD + ((100 - y) / 100) * INNER]
}

function dist(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function normal(a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}

/**
 * Build a filled ribbon outline around a median (approximate calligraphy stroke).
 * Returns an SVG path `d` string closed with Z.
 */
export function medianToStrokeOutline(median, halfWidth = 48) {
  if (!median || median.length < 2) return ''
  const pts = median.map(mapPt)
  const left = []
  const right = []

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(pts.length - 1, i + 1)]
    const [nx, ny] = normal(prev, next)
    const p = pts[i]
    left.push([p[0] + nx * halfWidth, p[1] + ny * halfWidth])
    right.push([p[0] - nx * halfWidth, p[1] - ny * halfWidth])
  }

  // Round caps: fan at start/end
  const startCap = []
  const endCap = []
  const steps = 8
  {
    const [nx, ny] = normal(pts[0], pts[1])
    const tx = (pts[1][0] - pts[0][0]) / (dist(pts[0], pts[1]) || 1)
    const ty = (pts[1][1] - pts[0][1]) / (dist(pts[0], pts[1]) || 1)
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / steps
      const cx = Math.cos(a)
      const cy = Math.sin(a)
      // rotate from -normal toward -tangent
      const rx = -nx * cx + -tx * cy
      const ry = -ny * cx + -ty * cy
      startCap.push([pts[0][0] + rx * halfWidth, pts[0][1] + ry * halfWidth])
    }
  }
  {
    const n = pts.length
    const [nx, ny] = normal(pts[n - 2], pts[n - 1])
    const tx = (pts[n - 1][0] - pts[n - 2][0]) / (dist(pts[n - 2], pts[n - 1]) || 1)
    const ty = (pts[n - 1][1] - pts[n - 2][1]) / (dist(pts[n - 2], pts[n - 1]) || 1)
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / steps
      const cx = Math.cos(a)
      const cy = Math.sin(a)
      const rx = nx * cx + tx * cy
      const ry = ny * cx + ty * cy
      endCap.push([pts[n - 1][0] + rx * halfWidth, pts[n - 1][1] + ry * halfWidth])
    }
  }

  const ring = [...startCap, ...left, ...endCap, ...right.reverse()]
  let d = `M ${ring[0][0].toFixed(1)} ${ring[0][1].toFixed(1)}`
  for (let i = 1; i < ring.length; i++) {
    d += ` L ${ring[i][0].toFixed(1)} ${ring[i][1].toFixed(1)}`
  }
  d += ' Z'
  return d
}

export function lessonToHanziData(lesson, halfWidth = 52) {
  const medians = lesson.steps.map((s) => s.path.map(mapPt))
  const strokes = lesson.steps.map((s) => medianToStrokeOutline(s.path, halfWidth))
  return { strokes, medians }
}

const CACHE = {}

/** Hanzi Writer charDataLoader-compatible data for a consonant id (c1…c30). */
export function getTibetanHanziData(consonantId) {
  if (CACHE[consonantId]) return CACHE[consonantId]
  const lesson = getStrokeLesson(consonantId)
  const data = lessonToHanziData(lesson)
  CACHE[consonantId] = data
  return data
}

export function preloadAllTibetanHanziData() {
  Object.keys(STROKE_LESSONS).forEach(getTibetanHanziData)
}

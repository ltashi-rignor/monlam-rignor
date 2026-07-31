/**
 * Stroke ownership atlas (Hanzi Guide–style).
 *
 * Preprocess:
 *   render glyph → every ink pixel → owner + monotonic progress + distance
 *
 * Runtime (Handwriting.jsx animation loop drives fills[s] 0→1):
 *   if owner == stroke && progress <= currentProgress → paint
 *
 * Fixes vs prior version:
 *   1) No silent Voronoi fallback at junctions — pick best relative fit
 *      (dist / localRadius), prefer earlier stroke on ties.
 *   2) Progress is geodesic from stroke start through owned pixels only
 *      — monotonic reveal, no hook/loop jumps from polyline projection.
 */

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function projectToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const len2 = vx * vx + vy * vy || 1
  let t = ((px - ax) * vx + (py - ay) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: ax + vx * t, y: ay + vy * t, t }
}

/** Closest point on polyline (used for scoring + draw matching). */
export function nearestOnPolyline(px, py, poly) {
  if (!poly || poly.length < 2) {
    return { dist: Infinity, progress: 0, x: px, y: py, tx: 1, ty: 0 }
  }
  let bestD = Infinity
  let bestProg = 0
  let bestX = px
  let bestY = py
  let bestTx = 1
  let bestTy = 0
  let walked = 0
  const segLens = []
  for (let i = 1; i < poly.length; i++) {
    segLens.push(Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]))
  }
  const total = segLens.reduce((a, b) => a + b, 0) || 1

  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1]
    const b = poly[i]
    const hit = projectToSegment(px, py, a[0], a[1], b[0], b[1])
    const d = dist2(px, py, hit.x, hit.y)
    if (d < bestD) {
      bestD = d
      bestProg = (walked + hit.t * segLens[i - 1]) / total
      bestX = hit.x
      bestY = hit.y
      const lx = b[0] - a[0]
      const ly = b[1] - a[1]
      const len = Math.hypot(lx, ly) || 1
      bestTx = lx / len
      bestTy = ly / len
    }
    walked += segLens[i - 1]
  }
  return {
    dist: Math.sqrt(bestD),
    progress: bestProg,
    x: bestX,
    y: bestY,
    tx: bestTx,
    ty: bestTy,
  }
}

function pointAlongPolyline(poly, t) {
  if (!poly?.length) return null
  if (poly.length === 1) return { x: poly[0][0], y: poly[0][1], tx: 1, ty: 0 }
  const segLens = []
  for (let i = 1; i < poly.length; i++) {
    segLens.push(Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]))
  }
  const total = segLens.reduce((a, b) => a + b, 0) || 1
  let target = Math.max(0, Math.min(1, t)) * total
  let walked = 0
  for (let i = 1; i < poly.length; i++) {
    const len = segLens[i - 1]
    const a = poly[i - 1]
    const b = poly[i]
    if (walked + len >= target) {
      const u = (target - walked) / (len || 1)
      const lx = b[0] - a[0]
      const ly = b[1] - a[1]
      const L = Math.hypot(lx, ly) || 1
      return {
        x: a[0] + lx * u,
        y: a[1] + ly * u,
        tx: lx / L,
        ty: ly / L,
      }
    }
    walked += len
  }
  const last = poly[poly.length - 1]
  const prev = poly[poly.length - 2]
  const lx = last[0] - prev[0]
  const ly = last[1] - prev[1]
  const L = Math.hypot(lx, ly) || 1
  return { x: last[0], y: last[1], tx: lx / L, ty: ly / L }
}

function inkBounds(data, size) {
  let minX = size
  let minY = size
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] < 16) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) {
    return { minX: size * 0.2, minY: size * 0.2, maxX: size * 0.8, maxY: size * 0.8 }
  }
  const pad = Math.max(2, Math.floor(size * 0.015))
  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(size - 1, maxX + pad),
    maxY: Math.min(size - 1, maxY + pad),
  }
}

export function mapMediansToGlyphBox(paths, bounds) {
  const { minX, minY, maxX, maxY } = bounds
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  return paths.map((path) =>
    path.map(([x, y]) => [minX + (x / 100) * w, minY + (y / 100) * h]),
  )
}

export function mapMediansToCanvas(paths, size, pad = 0.14) {
  return mapMediansToGlyphBox(paths, {
    minX: size * pad,
    minY: size * pad,
    maxX: size * (1 - pad),
    maxY: size * (1 - pad),
  })
}

function isInk(data, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false
  return data[(y * size + x) * 4 + 3] >= 16
}

function snapToOwnedInk(data, size, ownerMap, stroke, x, y, radius) {
  const cx = Math.round(x)
  const cy = Math.round(y)
  const n = size * size
  let best = null
  let bestD = Infinity
  const r = Math.ceil(radius)
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx
      const py = cy + dy
      if (!isInk(data, size, px, py)) continue
      const i = py * size + px
      if (i < 0 || i >= n || ownerMap[i] !== stroke) continue
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
  }
  return best
}

/** Half-width of ink ⊥ to median — used only for ownership scoring. */
function buildLocalRadius(data, size, poly, samples = 24) {
  const radii = new Float32Array(samples + 1)
  const maxRay = Math.max(12, Math.round(size * 0.12))

  for (let k = 0; k <= samples; k++) {
    const t = k / samples
    const pt = pointAlongPolyline(poly, t)
    if (!pt) {
      radii[k] = maxRay * 0.5
      continue
    }
    const nx = -pt.ty
    const ny = pt.tx
    let half = 0
    for (const sign of [-1, 1]) {
      let w = 0
      for (let step = 1; step <= maxRay; step++) {
        const x = Math.round(pt.x + nx * sign * step)
        const y = Math.round(pt.y + ny * sign * step)
        if (!isInk(data, size, x, y)) break
        w = step
      }
      half = Math.max(half, w)
    }
    radii[k] = Math.max(4, half * 1.2)
  }

  return {
    samples,
    radii,
    at(t) {
      const u = Math.max(0, Math.min(1, t)) * samples
      const i0 = Math.floor(u)
      const i1 = Math.min(samples, i0 + 1)
      const f = u - i0
      return radii[i0] * (1 - f) + radii[i1] * f
    },
  }
}

const NO_INK = 0xffff

/**
 * After owners are set: progress = geodesic distance from stroke START
 * through that stroke's pixels only (normalized 0..65535).
 * Guarantees monotonic reveal even on hooks/curves.
 */
function assignGeodesicProgress(data, size, ownerMap, progressMap, medians, byStroke) {
  const n = size * size
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  const glyphH = (() => {
    const b = inkBounds(data, size)
    return Math.max(1, b.maxY - b.minY)
  })()
  const snapR = Math.max(10, Math.round(glyphH * 0.12))

  for (let s = 0; s < medians.length; s++) {
    const poly = medians[s]
    if (!poly || poly.length < 2) continue

    const geo = new Float32Array(n)
    geo.fill(Infinity)
    const queue = []
    let qh = 0

    for (let k = 0; k <= 6; k++) {
      const t = k / 40
      const pt = pointAlongPolyline(poly, t)
      if (!pt) continue
      const seed = snapToOwnedInk(data, size, ownerMap, s, pt.x, pt.y, snapR)
      if (seed == null) continue
      if (geo[seed] > 0) {
        geo[seed] = 0
        queue.push(seed)
      }
    }

    if (queue.length === 0 && byStroke[s].length) {
      const pt = pointAlongPolyline(poly, 0)
      let best = byStroke[s][0]
      let bestD = Infinity
      for (const i of byStroke[s]) {
        const x = i % size
        const y = (i / size) | 0
        const d = dist2(x, y, pt.x, pt.y)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      geo[best] = 0
      queue.push(best)
    }

    while (qh < queue.length) {
      const i = queue[qh++]
      const x = i % size
      const y = (i / size) | 0
      const d0 = geo[i]
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (!isInk(data, size, nx, ny)) continue
        const ni = ny * size + nx
        if (ownerMap[ni] !== s) continue
        const nd = d0 + 1
        if (nd < geo[ni]) {
          geo[ni] = nd
          queue.push(ni)
        }
      }
    }

    let maxD = 0
    for (const i of byStroke[s]) {
      if (geo[i] < Infinity && geo[i] > maxD) maxD = geo[i]
    }
    if (maxD < 1) maxD = 1

    for (const i of byStroke[s]) {
      const d = geo[i] < Infinity ? geo[i] : maxD
      progressMap[i] = Math.max(0, Math.min(65535, Math.round((d / maxD) * 65535)))
    }

    byStroke[s].sort((ia, ib) => progressMap[ia] - progressMap[ib])
  }
}

/**
 * Build ownership atlas for one letter.
 *
 * Pass 1 — confident ownership (inside local radius + clear margin)
 * Pass 2 — geodesic flood through ink from confident seeds (no corner leaps)
 * Pass 3 — isolated leftovers → nearest median
 * Then remap progress geodesically from each stroke's start (monotonic reveal)
 */
export function buildGlyphStrokeMap(letter, lessonPaths, size, fontFamily) {
  const glyphCanvas = document.createElement('canvas')
  glyphCanvas.width = size
  glyphCanvas.height = size
  const gctx = glyphCanvas.getContext('2d', { willReadFrequently: true })
  gctx.clearRect(0, 0, size, size)
  gctx.fillStyle = '#000'
  gctx.textAlign = 'center'
  gctx.textBaseline = 'middle'
  gctx.font = `${Math.floor(size * 0.72)}px ${fontFamily}`
  gctx.fillText(letter, size / 2, size / 2 + size * 0.02)

  const { data } = gctx.getImageData(0, 0, size, size)
  const bounds = inkBounds(data, size)
  const medians = mapMediansToGlyphBox(lessonPaths, bounds)
  const n = size * size
  const strokeCount = medians.length

  const localR = medians.map((poly) => buildLocalRadius(data, size, poly))

  const ownerMap = new Uint16Array(n)
  const progressMap = new Uint16Array(n)
  const distMap = new Uint16Array(n)
  ownerMap.fill(NO_INK)

  // --- Pass 1: CONFIDENT ownership only -----------------------------
  // Leave junction/corner pixels unassigned rather than guessing by
  // raw straight-line distance (that bled head color into stems).
  const inkPixels = []

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isInk(data, size, x, y)) continue
      const i = y * size + x
      inkPixels.push(i)

      const ranked = []
      for (let s = 0; s < strokeCount; s++) {
        const hit = nearestOnPolyline(x, y, medians[s])
        ranked.push({ s, dist: hit.dist, progress: hit.progress })
      }
      ranked.sort((a, b) => a.dist - b.dist || a.s - b.s)

      const best = ranked[0]
      const second = ranked[1]
      const bestFits = best.dist <= localR[best.s].at(best.progress)
      // Seam pixels (overlapping radii) stay unassigned for pass 2
      const clearMargin = !second || second.dist > best.dist * 1.35

      if (bestFits && clearMargin) {
        ownerMap[i] = best.s
        progressMap[i] = Math.max(0, Math.min(65535, Math.round(best.progress * 65535)))
        distMap[i] = Math.max(0, Math.min(65535, Math.round(best.dist * 16)))
      }
    }
  }

  // --- Pass 2: geodesic flood-fill through ink ----------------------
  // Multi-source BFS from confident seeds — ownership can't leap
  // across a corner the way Euclidean nearest-median can.
  const queue = []
  let qHead = 0
  for (const i of inkPixels) {
    if (ownerMap[i] !== NO_INK) queue.push(i)
  }
  const W = size
  while (qHead < queue.length) {
    const i = queue[qHead++]
    const owner = ownerMap[i]
    const x = i % W
    const y = (i / W) | 0
    const neighbors = []
    if (x + 1 < W) neighbors.push(i + 1)
    if (x - 1 >= 0) neighbors.push(i - 1)
    if (y + 1 < size) neighbors.push(i + W)
    if (y - 1 >= 0) neighbors.push(i - W)

    for (const j of neighbors) {
      if (ownerMap[j] !== NO_INK) continue
      if (!isInk(data, size, j % W, (j / W) | 0)) continue
      ownerMap[j] = owner
      const jx = j % W
      const jy = (j / W) | 0
      const hit = nearestOnPolyline(jx, jy, medians[owner])
      progressMap[j] = Math.max(0, Math.min(65535, Math.round(hit.progress * 65535)))
      distMap[j] = Math.max(0, Math.min(65535, Math.round(hit.dist * 16)))
      queue.push(j)
    }
  }

  // --- Pass 3: leftover isolated ink → nearest median ---------------
  for (const i of inkPixels) {
    if (ownerMap[i] !== NO_INK) continue
    const x = i % W
    const y = (i / W) | 0
    let bestS = 0
    let bestD = Infinity
    let bestP = 0
    for (let s = 0; s < strokeCount; s++) {
      const hit = nearestOnPolyline(x, y, medians[s])
      if (hit.dist < bestD) {
        bestD = hit.dist
        bestS = s
        bestP = hit.progress
      }
    }
    ownerMap[i] = bestS
    progressMap[i] = Math.max(0, Math.min(65535, Math.round(bestP * 65535)))
    distMap[i] = Math.max(0, Math.min(65535, Math.round(bestD * 16)))
  }

  const byStroke = Array.from({ length: strokeCount }, () => [])
  for (const i of inkPixels) {
    byStroke[ownerMap[i]].push(i)
  }

  // Remap progress: geodesic from stroke start (monotonic reveal)
  assignGeodesicProgress(data, size, ownerMap, progressMap, medians, byStroke)

  const colorLayer = document.createElement('canvas')
  colorLayer.width = size
  colorLayer.height = size

  return {
    size,
    glyphCanvas,
    medians,
    bounds,
    ownerMap,
    progressMap,
    distMap,
    byStroke,
    colorLayer,
    strokeCount,
    NO_INK,
    get owner() {
      return ownerMap
    },
    get progress() {
      return progressMap
    },
    get dist() {
      return distMap
    },
  }
}

/**
 * Runtime reveal from atlas.
 * fills[s] ∈ [0,1] — driven by Handwriting.jsx rAF loop.
 */
export function paintAtlasFills(ctx, map, fills, colors, highlightStroke = -1) {
  const { size, byStroke, progressMap, colorLayer } = map
  const lctx = colorLayer.getContext('2d')
  if (!map._img) map._img = lctx.createImageData(size, size)
  const out = map._img.data
  out.fill(0)

  const isHighlightStroke = (s) => s === highlightStroke && (fills[s] || 0) < 0.999
  const highlightColor = [170, 204, 255]

  for (let s = 0; s < byStroke.length; s++) {
    const p = fills[s] || 0
    if (p <= 0.001) continue
    // At completion, paint every owned pixel (no leftover holes)
    const cut = p >= 0.999 ? 65535 : Math.min(65535, Math.round(p * 65535))
    const [r, g, b] = isHighlightStroke(s) ? highlightColor : colors[s % colors.length]
    const pixels = byStroke[s]
    for (const i of pixels) {
      if (progressMap[i] > cut) continue
      const o = i * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 235
    }
  }

  lctx.putImageData(map._img, 0, 0)
  ctx.drawImage(colorLayer, 0, 0)
}

export const FILL_COLORS = [
  [196, 122, 22],
  [26, 107, 118],
  [139, 69, 19],
  [45, 106, 79],
  [155, 34, 38],
  [92, 77, 122],
  [181, 101, 29],
]

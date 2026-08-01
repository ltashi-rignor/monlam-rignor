import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { en } from '../src/i18n/en.js'
import { bo } from '../src/i18n/bo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.join(__dirname, '../src')

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function mergeDict(base, overlay) {
  if (!isObject(overlay)) return overlay ?? base
  const out = { ...base }
  for (const key of Object.keys(overlay)) {
    const b = base?.[key]
    const o = overlay[key]
    out[key] = isObject(o) && isObject(b) ? mergeDict(b, o) : o
  }
  return out
}

function get(obj, parts) {
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

const ten = mergeDict(bo, en)
const tbo = mergeDict(en, bo)
const pathRe = /\bt\.([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*){1,4})\b/g

function walk(d, paths = []) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p, paths)
    else if (/\.(jsx|js)$/.test(ent.name) && !p.includes(`${path.sep}i18n${path.sep}`)) paths.push(p)
  }
  return paths
}

const missing = []
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('useI18n')) continue
  const seen = new Set()
  let m
  while ((m = pathRe.exec(text))) {
    const key = m[1]
    if (seen.has(key)) continue
    seen.add(key)
    const parts = key.split('.')
    const ven = get(ten, parts)
    const vbo = get(tbo, parts)
    if (ven === undefined || vbo === undefined) {
      missing.push({
        file: path.relative(path.join(__dirname, '..'), file),
        key,
        missingEn: ven === undefined,
        missingBo: vbo === undefined,
      })
    }
  }
}

console.log(JSON.stringify(missing, null, 2))
console.log('TOTAL', missing.length)

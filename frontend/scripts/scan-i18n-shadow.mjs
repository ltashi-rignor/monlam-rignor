/**
 * Fail if a useI18n component shadows i18n `t` with a local binding
 * (callback param or `const t = …`) in a way that still reads i18n roots
 * through that same name — classic crash: t.modules / t.grammar is undefined.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.join(__dirname, '../src')
const I18N_ROOTS =
  /\bt\.(nav|modules|grammar|essay|practice|progress|onboarding|cms|brand|loading|signOut|dashboard|login|auth)\b/

function walk(d, paths = []) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name)
    if (ent.isDirectory()) walk(p, paths)
    else if (/\.(jsx|js)$/.test(ent.name)) paths.push(p)
  }
  return paths
}

const issues = []
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes('useI18n')) continue
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const shadows =
      /\.(?:map|forEach|filter|find|some|every|flatMap)\(\s*(?:async\s*)?\(\s*t\s*(?:,|\))/.test(
        line,
      ) ||
      /\bconst\s+t\s*=/.test(line) ||
      /\blet\s+t\s*=/.test(line)
    if (!shadows) continue
    // Look ahead a bit for i18n-root access on `t` in the same local scope window
    const window = lines.slice(i, i + 25).join('\n')
    if (I18N_ROOTS.test(window)) {
      // Ignore pure i18n: const { t } = useI18n()
      if (/const\s+\{\s*[^}]*\bt\b[^}]*\}\s*=\s*useI18n/.test(line)) continue
      issues.push(
        `${path.relative(path.join(__dirname, '..'), file)}:${i + 1}: ${line.trim().slice(0, 100)}`,
      )
    }
  }
}

if (issues.length) {
  console.error('i18n `t` shadowing detected (rename the local `t`):')
  for (const i of issues) console.error(' -', i)
  process.exit(1)
}
console.log('OK: no i18n t-shadowing in useI18n components')

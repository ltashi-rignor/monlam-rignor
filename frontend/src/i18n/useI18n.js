import { useMemo } from 'react'
import { bo } from './bo'
import { en } from './en'
import { useLocaleStore } from '../store/localeStore'

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

/** Deep-merge overlay onto base so English can fall back to Tibetan for missing keys. */
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

export function useI18n() {
  const lang = useLocaleStore((s) => s.lang)
  const setLang = useLocaleStore((s) => s.setLang)
  const toggleLang = useLocaleStore((s) => s.toggleLang)

  const t = useMemo(() => (lang === 'en' ? mergeDict(bo, en) : bo), [lang])

  return { t, lang, setLang, toggleLang, isEn: lang === 'en' }
}

/** Pick Tibetan or English field from a CMS API post. */
export function postTitle(post, lang) {
  if (!post) return ''
  if (lang === 'en' && post.title_en) return post.title_en
  return post.title_bo || post.title_en || ''
}

export function postBody(post, lang) {
  if (!post) return ''
  // Body is primarily Tibetan in seed; English titles still show Tibetan body until translated
  return post.body || post.excerpt || ''
}

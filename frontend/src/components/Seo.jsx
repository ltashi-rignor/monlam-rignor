import { useEffect } from 'react'

/** Lightweight SEO helper for public CMS pages. */
export default function Seo({ title, description }) {
  useEffect(() => {
    const prev = document.title
    if (title) document.title = title
    let meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content') || ''
    if (description) {
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', description)
    }
    return () => {
      document.title = prev
      if (meta && description) meta.setAttribute('content', prevDesc)
    }
  }, [title, description])
  return null
}

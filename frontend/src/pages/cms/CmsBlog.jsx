import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import Seo from '../../components/Seo'
import { postTitle, useI18n } from '../../i18n/useI18n'

export default function CmsBlog() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .cmsPosts('blog')
      .then((d) => setItems(d.items || []))
      .catch((e) => setErr(e.message))
  }, [])

  return (
    <div className="cms-page">
      <div className="cms-wrap">
        <Seo title={t.cms.blog.seoTitle} description={t.cms.blog.seoDesc} />
        <p className="cms-eyebrow">{t.cms.blog.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.blog.title}</h1>
        <p className="cms-lead">{t.cms.blog.lead}</p>
        {err && <p className="error">{err}</p>}
        <div className="cms-post-list">
          {items.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="cms-post-card">
              <h2>{postTitle(p, lang)}</h2>
              {lang === 'en' && p.title_bo && p.title_en ? (
                <p className="muted cms-secondary-title">{p.title_bo}</p>
              ) : null}
              <p>{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

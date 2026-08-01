import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import Seo from '../../components/Seo'
import { postTitle, useI18n } from '../../i18n/useI18n'

export default function CmsFaq() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .cmsPosts('faq')
      .then((d) => setItems(d.items || []))
      .catch((e) => setErr(e.message))
  }, [])

  return (
    <div className="cms-page">
      <div className="cms-wrap">
        <Seo title={t.cms.faq.seoTitle} description={t.cms.faq.seoDesc} />
        <p className="cms-eyebrow">{t.cms.faq.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.faq.title}</h1>
        <p className="cms-lead">{t.cms.faq.lead}</p>
        {err && <p className="error">{err}</p>}
        <div className="cms-faq-list">
          {items.map((item) => {
            const isOpen = open === item.id
            return (
              <div key={item.id} className={`cms-faq-item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="cms-faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : item.id)}
                >
                  {postTitle(item, lang)}
                </button>
                {isOpen && <div className="cms-faq-a">{item.body}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

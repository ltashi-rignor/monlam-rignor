import { useState } from 'react'
import { api } from '../../api/client'
import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'

export default function CmsContact() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setOk(false)
    try {
      await api.cmsContact({ name, email, subject, message })
      setOk(true)
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cms-page">
      <div className="cms-wrap cms-contact">
        <Seo title={t.cms.contact.seoTitle} description={t.cms.contact.seoDesc} />
        <p className="cms-eyebrow">{t.cms.contact.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.contact.title}</h1>
        <p className="cms-lead">{t.cms.contact.lead}</p>
        <form className="cms-contact-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="c-name">{t.cms.contact.name}</label>
            <input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-email">{t.cms.contact.email}</label>
            <input
              id="c-email"
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="c-subject">{t.cms.contact.subject}</label>
            <input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c-msg">{t.cms.contact.message}</label>
            <textarea
              id="c-msg"
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {err && <p className="error">{err}</p>}
          {ok && <p className="success">{t.cms.contact.success}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t.cms.contact.sending : t.cms.contact.send}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { bo } from '../i18n/bo'

const STARTERS = [
  "How do I say 'good morning' in Tibetan?",
  'Translate to Tibetan: I love learning your language.',
  'Explain the vowel signs of Tibetan script.',
  'Give me 5 useful phrases for a traveller in Lhasa.',
]

export default function Tutor() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'བཀྲ་ཤིས་བདེ་ལེགས། I\'m Lobsang, your Tibetan tutor on Monlam Melong. Ask me anything about the language — vocabulary, grammar, or culture.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, busy])

  async function send(prompt) {
    const text = (prompt ?? input).trim()
    if (!text || busy) return
    setErr('')
    const nextMsgs = [...messages, { role: 'user', content: text }]
    setMessages(nextMsgs)
    setInput('')
    setBusy(true)
    try {
      const data = await api.tutorChat(nextMsgs.map(({ role, content }) => ({ role, content })))
      setMessages([...nextMsgs, { role: 'assistant', content: data.reply || '…' }])
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="module-page tutor-page tibetan">
      <header className="page-header">
        <div>
          <p className="module-eyebrow">{bo.modules.tutorEyebrow}</p>
          <h1>{bo.modules.tutorTitle}</h1>
          <p>{bo.modules.tutorSub}</p>
        </div>
      </header>

      <div className="panel tutor-shell">
        <div className="tutor-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`tutor-msg ${m.role === 'user' ? 'is-user' : 'is-ai'}`}>
              <div className="tutor-avatar">{m.role === 'user' ? 'ཁྱེད།' : 'བློ།'}</div>
              <div className="tutor-bubble tibetan">{m.content}</div>
            </div>
          ))}
          {busy && (
            <div className="tutor-msg is-ai">
              <div className="tutor-avatar">བློ།</div>
              <div className="tutor-bubble muted">{bo.modules.thinking}</div>
            </div>
          )}
          {err && <p className="error">{err}</p>}
        </div>

        {messages.length <= 1 && (
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {STARTERS.map((p) => (
              <button key={p} type="button" className="chip-btn" onClick={() => send(p)}>
                {p}
              </button>
            ))}
          </div>
        )}

        <form
          className="tutor-form"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            className="tibetan"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={bo.modules.tutorPh}
          />
          <button className="btn btn-primary" disabled={busy || !input.trim()}>
            {bo.modules.send}
          </button>
        </form>
      </div>
    </div>
  )
}

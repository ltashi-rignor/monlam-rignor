import { useState } from 'react'
import { bo } from '../i18n/bo'

export default function AIChat({ onSend, placeholder = bo.chat.placeholder }) {
  const [messages, setMessages] = useState([{ role: 'ai', text: bo.chat.intro }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!input.trim() || busy) return
    const text = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const reply = onSend ? await onSend(text) : ''
      setMessages((m) => [...m, { role: 'ai', text: reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'ai', text: err.message }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel tibetan">
      <h3 style={{ marginTop: 0 }}>{bo.chat.title}</h3>
      <div className="chat-box">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'ai'} tibetan`}>
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          className="tibetan"
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid var(--line)',
            padding: '12px 14px',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
        />
        <button className="btn btn-primary" disabled={busy}>
          {bo.chat.send}
        </button>
      </form>
    </div>
  )
}

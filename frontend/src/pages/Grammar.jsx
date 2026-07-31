import { useState } from 'react'
import { api } from '../api/client'
import GrammarResult from '../components/GrammarResult'
import { bo } from '../i18n/bo'

export default function Grammar() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function check(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api.checkGrammar(text)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tibetan">
      <header className="page-header">
        <div>
          <h1>{bo.grammar.title}</h1>
          <p>{bo.grammar.sub}</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="panel" onSubmit={check}>
          <div className="field">
            <label>{bo.grammar.label}</label>
            <textarea
              className="tibetan"
              rows={12}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={bo.grammar.placeholder}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? bo.grammar.checking : bo.grammar.run}
          </button>
        </form>
        <GrammarResult result={result} />
      </div>
    </div>
  )
}

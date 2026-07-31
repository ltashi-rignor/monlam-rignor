import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import GrammarResult from '../components/GrammarResult'
import { bo } from '../i18n/bo'
import { mistakeTypeBo, tibetanOrFallback } from '../i18n/labels'

const SAMPLES = [
  {
    label: 'དཔེ་༡',
    text: 'ང་སློབ་གྲྭ་ལ་འགྲོ། དགེ་རྒན་ལགས་ཁྱེད་རང་ག་རེ་གནང་གི་ཡོད།',
  },
  {
    label: 'དཔེ་༢',
    text: 'ཁོང་གིས་དཔེ་ཆ་ཀློག་གི་ཡོད། ང་ཚོ་སེམས་ཅན་ལ་དགའ་པོ་ཡོད།',
  },
  {
    label: 'དཔེ་༣',
    text: 'བུ་མོ་དེ་སློབ་ཚན་འབྲི་བཞིན་ཡོད། ཁྱེད་རང་ག་རེ་བྱེད་ཀྱི་ཡོད།',
  },
]

export default function Grammar() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [checkedText, setCheckedText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])

  async function loadRecent() {
    try {
      const rows = await api.recentGrammarMistakes(6)
      setRecent(rows || [])
    } catch {
      setRecent([])
    }
  }

  useEffect(() => {
    loadRecent()
  }, [])

  async function check(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api.checkGrammar(text)
      setResult(data)
      setCheckedText(text)
      await loadRecent()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function clearAll() {
    setText('')
    setResult(null)
    setCheckedText('')
    setError('')
  }

  return (
    <div className="tibetan grammar-page">
      <header className="page-header">
        <div>
          <h1>{bo.grammar.title}</h1>
          <p>{bo.grammar.sub}</p>
        </div>
        <Link className="btn btn-ghost" to="/practice">
          {bo.grammar.goPractice}
        </Link>
      </header>

      <div className="grammar-layout">
        <div className="grammar-compose">
          <form className="panel" onSubmit={check}>
            <div className="sample-row">
              <span className="sample-label">{bo.grammar.samples}</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn btn-ghost sample-chip"
                  onClick={() => {
                    setText(s.text)
                    setResult(null)
                    setCheckedText('')
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="field">
              <label>{bo.grammar.label}</label>
              <textarea
                className="tibetan grammar-textarea"
                rows={12}
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={bo.grammar.placeholder}
              />
              <div className="field-meta">
                <span dir="ltr">{text.trim().length}</span>
                <span>{bo.grammar.chars}</span>
              </div>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="grammar-actions">
              <button className="btn btn-primary" disabled={busy || !text.trim()}>
                {busy ? bo.grammar.checking : bo.grammar.run}
              </button>
              <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={busy}>
                {bo.grammar.clear}
              </button>
            </div>
          </form>

          {!!recent.length && (
            <section className="panel recent-mistakes">
              <div className="recent-head">
                <h3 style={{ margin: 0 }}>{bo.grammar.recent}</h3>
                <Link to="/practice">{bo.grammar.practiceFromMistakes}</Link>
              </div>
              <ul className="recent-list">
                {recent.map((m) => (
                  <li key={m.id}>
                    <span className="mistake-badge kind-grammar">
                      {mistakeTypeBo(m.mistake_type)}
                    </span>
                    <div className="recent-diff">
                      <span className="diff-bad">{m.original}</span>
                      <span aria-hidden> → </span>
                      <span className="diff-good">{m.correction}</span>
                    </div>
                    {tibetanOrFallback(m.explanation, '') && (
                      <p className="recent-explain">{tibetanOrFallback(m.explanation, '')}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <GrammarResult
          result={result}
          originalText={checkedText}
          onApplyCorrection={() => {
            if (result?.corrected_version) setText(result.corrected_version)
          }}
        />
      </div>
    </div>
  )
}

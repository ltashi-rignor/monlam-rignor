import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import GrammarGame from '../components/GrammarGame'
import GrammarResult from '../components/GrammarResult'
import WorkingProgress from '../components/WorkingProgress'
import { grammarSamples } from '../lib/contentSamples'
import { useI18n } from '../i18n/useI18n'
import { mistakeTypeBo, tibetanOrFallback } from '../i18n/labels'

const SAMPLES = grammarSamples.length
  ? grammarSamples
  : [
      {
        label: 'དཔེ་༡',
        text: 'ང་སློབ་གྲྭ་ལ་འགྲོ། དགེ་རྒན་ལགས་ཁྱེད་རང་ག་རེ་གནང་གི་ཡོད།',
      },
    ]

const ACCEPT =
  '.txt,.md,.text,.docx,.pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,text/plain,application/pdf'

export default function Grammar() {
  const { t } = useI18n()
  const fileRef = useRef(null)

  const [mode, setMode] = useState('play')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [checkedText, setCheckedText] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState(null) // 'check' | 'upload' | null
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])
  const [fileMeta, setFileMeta] = useState(null)
  const [notice, setNotice] = useState('')

  const checkStages = useMemo(
    () => [
      t.grammar.checkStage1,
      t.grammar.checkStage2,
      t.grammar.checkStage3,
      t.grammar.checkStage4,
    ],
    [t],
  )
  const uploadStages = useMemo(
    () => [t.grammar.uploadStage1, t.grammar.uploadStage2, t.grammar.uploadStage3],
    [t],
  )

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

  function pickedFiles(e) {
    const list = Array.from(e.target.files || [])
    e.target.value = ''
    return list.slice(0, 5)
  }

  async function check(e) {
    e.preventDefault()
    setBusy(true)
    setBusyKind('check')
    setError('')
    setNotice('')
    try {
      const data = await api.checkGrammar(text)
      setResult(data)
      setCheckedText(text)
      await loadRecent()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  async function runFileLoad(fileList) {
    if (!fileList.length) return
    setBusy(true)
    setBusyKind('upload')
    setError('')
    setNotice('')
    try {
      const data = await api.extractGrammarFile(fileList.length === 1 ? fileList[0] : fileList)
      setText(data.text || '')
      setResult(null)
      setCheckedText('')
      setFileMeta({ name: data.filename || fileList[0]?.name, kind: data.file_kind })
      if (data.truncated) setNotice(t.grammar.truncatedNote)
      else if (data.file_kind === 'ocr' || data.file_kind === 'ocr_multi') {
        setNotice(t.grammar.ocrNote)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  async function onFileInputChange(e) {
    const list = pickedFiles(e)
    await runFileLoad(list)
  }

  function clearAll() {
    setText('')
    setResult(null)
    setCheckedText('')
    setError('')
    setNotice('')
    setFileMeta(null)
  }

  return (
    <div className="tibetan grammar-page">
      <header className="page-header">
        <div>
          <h1>{t.grammar.title}</h1>
          <p>{t.grammar.sub}</p>
        </div>
        <Link className="btn btn-ghost" to="/practice?from=grammar">
          {t.grammar.goPractice}
        </Link>
      </header>

      <div className="grammar-mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'play'}
          className={`grammar-mode-tab ${mode === 'play' ? 'is-on' : ''}`}
          onClick={() => setMode('play')}
        >
          {t.grammar.tabPlay}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'check'}
          className={`grammar-mode-tab ${mode === 'check' ? 'is-on' : ''}`}
          onClick={() => setMode('check')}
        >
          {t.grammar.tabCheck}
        </button>
      </div>

      {mode === 'play' ? (
        <GrammarGame
          generateGame={(topic) => api.generateGrammarGame(topic)}
          onRequestCheck={() => setMode('check')}
        />
      ) : (
        <div className="grammar-layout">
          <div className="grammar-compose">
            <form className="panel" onSubmit={check}>
              <div className="sample-row">
                <span className="sample-label">{t.grammar.samples}</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="btn btn-ghost sample-chip"
                    disabled={busy}
                    onClick={() => {
                      setText(s.text)
                      setResult(null)
                      setCheckedText('')
                      setFileMeta(null)
                      setNotice('')
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="grammar-upload">
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  accept={ACCEPT}
                  multiple
                  onChange={onFileInputChange}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {busyKind === 'upload' ? t.grammar.uploading : t.grammar.uploadLoad}
                </button>
                <span className="muted grammar-upload-hint">{t.grammar.uploadHint}</span>
              </div>

              {fileMeta?.name && (
                <p className="grammar-file-meta muted">
                  {t.grammar.uploadedAs}: <strong dir="ltr">{fileMeta.name}</strong>
                </p>
              )}
              {notice && <p className="grammar-file-notice">{notice}</p>}

              <div className="field">
                <label>{t.grammar.label}</label>
                <textarea
                  className="tibetan grammar-textarea"
                  rows={12}
                  required
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t.grammar.placeholder}
                />
                <div className="field-meta">
                  <span dir="ltr">{text.trim().length}</span>
                  <span>{t.grammar.chars}</span>
                </div>
              </div>

              {error && <p className="error">{error}</p>}

              <WorkingProgress
                active={busyKind === 'check'}
                title={t.grammar.checkTitle}
                stages={checkStages}
                compact
              />
              <WorkingProgress
                active={busyKind === 'upload'}
                title={t.grammar.uploadTitle}
                stages={uploadStages}
                compact
              />

              <div className="grammar-actions">
                <button className="btn btn-primary" disabled={busy || !text.trim()}>
                  {busyKind === 'check' ? t.grammar.checking : t.grammar.run}
                </button>
                <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={busy}>
                  {t.grammar.clear}
                </button>
              </div>
            </form>

            {!!recent.length && (
              <section className="panel recent-mistakes">
                <div className="recent-head">
                  <h3 style={{ margin: 0 }}>{t.grammar.recent}</h3>
                  <Link to="/practice?from=grammar&auto=1">{t.grammar.practiceFromMistakes}</Link>
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
      )}
    </div>
  )
}

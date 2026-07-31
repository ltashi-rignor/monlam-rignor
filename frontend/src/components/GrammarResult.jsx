import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bo } from '../i18n/bo'
import { mistakeTypeBo, tibetanOrFallback } from '../i18n/labels'

function highlightText(text, mistakes) {
  if (!text) return null
  const spans = (mistakes || [])
    .map((m) => m.original)
    .filter((o) => o && text.includes(o))
    .sort((a, b) => b.length - a.length)

  if (!spans.length) {
    return <span className="annotate-plain">{text}</span>
  }

  const parts = []
  let remaining = text
  let key = 0
  while (remaining.length) {
    let earliest = -1
    let match = null
    for (const span of spans) {
      const idx = remaining.indexOf(span)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        match = span
      }
    }
    if (earliest === -1 || !match) {
      parts.push(
        <span key={key++} className="annotate-plain">
          {remaining}
        </span>,
      )
      break
    }
    if (earliest > 0) {
      parts.push(
        <span key={key++} className="annotate-plain">
          {remaining.slice(0, earliest)}
        </span>,
      )
    }
    parts.push(
      <mark key={key++} className="annotate-err">
        {match}
      </mark>,
    )
    remaining = remaining.slice(earliest + match.length)
  }
  return parts
}

function MistakeCard({ mistake, kind }) {
  const type = mistakeTypeBo(mistake.mistake_type)
  const explanation = tibetanOrFallback(mistake.explanation, '')
  const rule = tibetanOrFallback(mistake.related_rule, '')
  const source = tibetanOrFallback(mistake.source_ref, '')

  return (
    <article className={`mistake-card kind-${kind}`}>
      <div className="mistake-card-top">
        <span className={`mistake-badge kind-${kind}`}>{type}</span>
      </div>
      <div className="mistake-diff">
        <span className="diff-bad">{mistake.original || '—'}</span>
        <span className="diff-arrow" aria-hidden>
          →
        </span>
        <span className="diff-good">{mistake.correction || '—'}</span>
      </div>
      {explanation && <p className="mistake-explain">{explanation}</p>}
      {rule && (
        <p className="mistake-rule">
          <strong>{bo.grammar.rule}</strong> {rule}
        </p>
      )}
      {source && (
        <p className="mistake-source">
          <strong>{bo.grammar.source}</strong> {source}
        </p>
      )}
    </article>
  )
}

function PracticePrompt({ question, index }) {
  const [open, setOpen] = useState(false)
  const q = tibetanOrFallback(question, '')
  if (!q) return null
  return (
    <div className="grammar-practice-item">
      <p>
        <span className="practice-num" dir="ltr">
          {index + 1}.
        </span>{' '}
        {q}
      </p>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
        {open ? bo.grammar.hideHint : bo.grammar.showHint}
      </button>
      {open && <p className="practice-hint">{bo.grammar.tryRewrite}</p>}
    </div>
  )
}

export default function GrammarResult({ result, originalText, onApplyCorrection }) {
  const mistakes = result?.mistakes || []
  const honorifics = result?.honorific_mistakes || []
  const all = useMemo(() => [...mistakes, ...honorifics], [mistakes, honorifics])
  const total = all.length
  const summary = tibetanOrFallback(result?.summary, '')
  const praise = tibetanOrFallback(result?.praise, '')
  const rules = (result?.related_rules || [])
    .map((r) => tibetanOrFallback(r, ''))
    .filter(Boolean)
  const questions = result?.practice_questions || []
  const sources = result?.retrieved_sources || []

  if (!result) {
    return (
      <div className="panel grammar-result grammar-empty tibetan">
        <h3 style={{ marginTop: 0 }}>{bo.grammar.result}</h3>
        <p className="muted">{bo.grammar.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="panel grammar-result tibetan">
      <div className="grammar-result-head">
        <h3 style={{ margin: 0 }}>{bo.grammar.result}</h3>
        <span className={`grammar-count ${total ? 'has-errors' : 'is-clean'}`}>
          {total
            ? `${bo.grammar.mistakeCount} ${total}`
            : bo.grammar.noMistakes}
        </span>
      </div>

      {(praise || summary) && (
        <div className="grammar-feedback">
          {praise && <p className="grammar-praise">{praise}</p>}
          {summary && <p className="grammar-summary">{summary}</p>}
        </div>
      )}

      {originalText && (
        <section className="grammar-section">
          <h4>{bo.grammar.annotated}</h4>
          <div className="annotate-box">{highlightText(originalText, all)}</div>
        </section>
      )}

      <section className="grammar-section">
        <div className="corrected-head">
          <h4>{bo.grammar.corrected}</h4>
          {onApplyCorrection && result.corrected_version && (
            <button type="button" className="btn btn-ghost" onClick={onApplyCorrection}>
              {bo.grammar.applyFix}
            </button>
          )}
        </div>
        <p className="corrected-text">{result.corrected_version}</p>
      </section>

      <section className="grammar-section">
        <h4>{bo.grammar.mistakes}</h4>
        {!mistakes.length && <p className="empty">{bo.grammar.noGeneralMistakes}</p>}
        <div className="mistake-list">
          {mistakes.map((m, i) => (
            <MistakeCard key={`g-${i}`} mistake={m} kind="grammar" />
          ))}
        </div>
      </section>

      <section className="grammar-section">
        <h4>{bo.grammar.honorifics}</h4>
        {!honorifics.length && <p className="empty">{bo.grammar.noHonorifics}</p>}
        <div className="mistake-list">
          {honorifics.map((m, i) => (
            <MistakeCard key={`h-${i}`} mistake={m} kind="honorific" />
          ))}
        </div>
      </section>

      {!!rules.length && (
        <section className="grammar-section">
          <h4>{bo.grammar.relatedRules}</h4>
          <ul className="grammar-rules">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {!!questions.length && (
        <section className="grammar-section">
          <h4>{bo.grammar.practiceQ}</h4>
          <div className="grammar-practice-list">
            {questions.map((q, i) => (
              <PracticePrompt key={i} question={q} index={i} />
            ))}
          </div>
          <Link className="btn btn-accent" to="/practice" style={{ marginTop: 8 }}>
            {bo.grammar.goPractice}
          </Link>
        </section>
      )}

      {!!sources.length && (
        <section className="grammar-section">
          <h4>{bo.grammar.sources}</h4>
          <ul className="grammar-sources">
            {sources.map((s, i) => (
              <li key={i}>
                <strong>
                  {bo.grammar.page} {s.page_number ?? '—'}
                </strong>
                {s.excerpt ? (
                  <p className="source-excerpt">{tibetanOrFallback(s.excerpt, s.excerpt)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

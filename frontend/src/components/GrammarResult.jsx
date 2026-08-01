import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { mistakeTypeBo, tibetanOrFallback } from '../i18n/labels'

function highlightText(text, mistakes, onTapSpan) {
  if (!text) return null
  const spans = (mistakes || [])
    .map((m, i) => ({ original: m.original, index: i }))
    .filter((o) => o.original && text.includes(o.original))
    .sort((a, b) => b.original.length - a.original.length)

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
      const idx = remaining.indexOf(span.original)
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
      <button
        key={key++}
        type="button"
        className="annotate-err annotate-err-btn"
        onClick={() => onTapSpan?.(match.index, match.original)}
      >
        {match.original}
      </button>,
    )
    remaining = remaining.slice(earliest + match.original.length)
  }
  return parts
}

function MistakeCard({ mistake, kind, id, active }) {
  const { t } = useI18n()
  const type = mistakeTypeBo(mistake.mistake_type)
  const explanation = tibetanOrFallback(mistake.explanation, '')
  const rule = tibetanOrFallback(mistake.related_rule, '')
  const source = tibetanOrFallback(mistake.source_ref, '')

  return (
    <article
      id={id}
      className={`mistake-card kind-${kind} ${active ? 'is-active' : ''}`}
    >
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
          <strong>{t.grammar.rule}</strong> {rule}
        </p>
      )}
      {source && (
        <p className="mistake-source">
          <strong>{t.grammar.source}</strong> {source}
        </p>
      )}
    </article>
  )
}

function PracticePrompt({ question, index }) {
  const { t } = useI18n()
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
        {open ? t.grammar.hideHint : t.grammar.showHint}
      </button>
      {open && <p className="practice-hint">{t.grammar.tryRewrite}</p>}
    </div>
  )
}

export default function GrammarResult({ result, originalText, onApplyCorrection }) {
  const { t } = useI18n()

  const mistakes = result?.mistakes || []
  const honorifics = result?.honorific_mistakes || []
  const all = useMemo(() => [...mistakes, ...honorifics], [mistakes, honorifics])
  const total = all.length
  const isClean = total === 0
  const summary = tibetanOrFallback(result?.summary, '')
  const praise = tibetanOrFallback(result?.praise, '')
  const rules = (result?.related_rules || [])
    .map((r) => tibetanOrFallback(r, ''))
    .filter(Boolean)
  const questions = result?.practice_questions || []
  const sources = result?.retrieved_sources || []
  const [activeId, setActiveId] = useState(null)
  const listRef = useRef(null)
  const showCorrected =
    !isClean &&
    result.corrected_version &&
    result.corrected_version.trim() !== (originalText || '').trim()

  function focusMistake(index, original) {
    // Prefer exact original match among combined list
    let target = index
    const byText = all.findIndex((m) => m.original === original)
    if (byText >= 0) target = byText
    const id = `mistake-card-${target}`
    setActiveId(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  if (!result) {
    return (
      <div className="panel grammar-result grammar-empty tibetan">
        <h3 style={{ marginTop: 0 }}>{t.grammar.result}</h3>
        <p className="muted">{t.grammar.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={`panel grammar-result tibetan${isClean ? ' is-clean' : ''}`}>
      <div className="grammar-result-head">
        <h3 style={{ margin: 0 }}>{t.grammar.result}</h3>
        <span className={`grammar-count ${total ? 'has-errors' : 'is-clean'}`}>
          {total
            ? `${t.grammar.mistakeCount} ${total}`
            : t.grammar.noMistakes}
        </span>
      </div>

      {(praise || summary || isClean) && (
        <div className={`grammar-feedback${isClean ? ' is-clean' : ''}`}>
          {praise && <p className="grammar-praise">{praise}</p>}
          {summary && <p className="grammar-summary">{summary}</p>}
          {isClean && !praise && !summary && (
            <p className="grammar-praise">{t.grammar.noMistakes}</p>
          )}
        </div>
      )}

      {originalText && !isClean && (
        <section className="grammar-section">
          <h4>{t.grammar.annotated}</h4>
          <p className="muted annotate-hint">{t.grammar.tapMistake}</p>
          <div className="annotate-box">{highlightText(originalText, all, focusMistake)}</div>
        </section>
      )}

      {showCorrected && (
        <section className="grammar-section">
          <div className="corrected-head">
            <h4>{t.grammar.corrected}</h4>
            {onApplyCorrection && (
              <button type="button" className="btn btn-ghost" onClick={onApplyCorrection}>
                {t.grammar.applyFix}
              </button>
            )}
          </div>
          <p className="corrected-text">{result.corrected_version}</p>
        </section>
      )}

      {!isClean && (
        <div ref={listRef}>
          <section className="grammar-section">
            <h4>{t.grammar.mistakes}</h4>
            {!mistakes.length && <p className="empty">{t.grammar.noGeneralMistakes}</p>}
            <div className="mistake-list">
              {mistakes.map((m, i) => (
                <MistakeCard
                  key={`g-${i}`}
                  id={`mistake-card-${i}`}
                  mistake={m}
                  kind="grammar"
                  active={activeId === `mistake-card-${i}`}
                />
              ))}
            </div>
          </section>

          <section className="grammar-section">
            <h4>{t.grammar.honorifics}</h4>
            {!honorifics.length && <p className="empty">{t.grammar.noHonorifics}</p>}
            <div className="mistake-list">
              {honorifics.map((m, i) => {
                const cardId = `mistake-card-${mistakes.length + i}`
                return (
                  <MistakeCard
                    key={`h-${i}`}
                    id={cardId}
                    mistake={m}
                    kind="honorific"
                    active={activeId === cardId}
                  />
                )
              })}
            </div>
          </section>
        </div>
      )}

      {!isClean && !!rules.length && (
        <section className="grammar-section">
          <h4>{t.grammar.relatedRules}</h4>
          <ul className="grammar-rules">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {!!questions.length && (
        <section className="grammar-section">
          <h4>{t.grammar.practiceQ}</h4>
          <div className="grammar-practice-list">
            {questions.map((q, i) => (
              <PracticePrompt key={i} question={q} index={i} />
            ))}
          </div>
          <Link className="btn btn-accent" to="/practice" style={{ marginTop: 8 }}>
            {t.grammar.goPractice}
          </Link>
        </section>
      )}

      {!!sources.length && (
        <section className="grammar-section">
          <h4>{t.grammar.sources}</h4>
          <p className="muted annotate-hint">
            {isClean
              ? t.grammar.groundedClean
              : t.grammar.groundedErrors}
          </p>
          <ul className="grammar-sources">
            {sources.map((s, i) => (
              <li key={i}>
                <strong>
                  {(s.source_name || 'grammar').replace(/-/g, ' ')}
                  {s.page_number != null ? ` · ${t.grammar.page} ${s.page_number}` : ''}
                </strong>
                {!isClean && s.excerpt ? (
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

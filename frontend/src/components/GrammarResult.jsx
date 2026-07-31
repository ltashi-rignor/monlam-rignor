import { bo } from '../i18n/bo'

export default function GrammarResult({ result }) {
  if (!result) return null

  const allMistakes = [...(result.mistakes || []), ...(result.honorific_mistakes || [])]

  return (
    <div className="panel grammar-result tibetan">
      <h3 style={{ marginTop: 0 }}>{bo.grammar.result}</h3>
      <p className="tibetan" style={{ whiteSpace: 'pre-wrap' }}>
        <strong>{bo.grammar.corrected}</strong>
        {'\n'}
        {result.corrected_version}
      </p>

      <h4>{bo.grammar.mistakes}</h4>
      {allMistakes.length === 0 && <p className="empty">{bo.grammar.noMistakes}</p>}
      {allMistakes.map((m, i) => (
        <div className="mistake" key={i}>
          <div dir="ltr">
            <strong>{m.mistake_type}</strong>
          </div>
          <div className="tibetan">
            {m.original} → {m.correction}
          </div>
          {m.explanation && (
            <p style={{ color: 'var(--muted)', margin: '6px 0' }} dir="ltr">
              {m.explanation}
            </p>
          )}
          {m.related_rule && (
            <p style={{ margin: 0 }} dir="ltr">
              {bo.grammar.rule}: {m.related_rule}
            </p>
          )}
          {m.source_ref && (
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }} dir="ltr">
              {bo.grammar.source}: {m.source_ref}
            </p>
          )}
        </div>
      ))}

      {!!result.related_rules?.length && (
        <>
          <h4>{bo.grammar.relatedRules}</h4>
          <ul dir="ltr">
            {result.related_rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {!!result.practice_questions?.length && (
        <>
          <h4>{bo.grammar.practiceQ}</h4>
          <ul dir="ltr">
            {result.practice_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}

      {!!result.retrieved_sources?.length && (
        <>
          <h4>{bo.grammar.sources}</h4>
          <ul dir="ltr">
            {result.retrieved_sources.map((s, i) => (
              <li key={i}>
                p.{s.page_number} {s.title}{' '}
                {s.score != null ? `(score ${Number(s.score).toFixed(2)})` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

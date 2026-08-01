import { useI18n } from '../i18n/useI18n'

export default function ProgressChart({ progress, compact = false }) {
  const { t, isEn } = useI18n()

  if (!progress) return <div className="empty">{t.loading}</div>

  const keys = [
    ['grammar_score', t.progress.grammar],
    ['writing_score', t.progress.writing],
    ['reading_score', t.progress.reading],
    ['speaking_score', t.progress.speaking],
    ['vocabulary_score', t.progress.vocabulary],
  ]

  return (
    <div className={`panel ${isEn ? 'is-en' : 'tibetan'}`}>
      <h3 style={{ marginTop: 0 }}>{t.progress.skills}</h3>
      <div className="progress-bars">
        {keys.map(([key, label]) => {
          const value = Math.max(0, Math.min(100, Number(progress[key] || 0)))
          return (
            <div className="bar-row" key={key}>
              <span>{label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${value}%` }} />
              </div>
              <strong dir="ltr">{Math.round(value)}</strong>
            </div>
          )
        })}
      </div>

      {!compact && !!progress.learning_graph?.next_focus?.length && (
        <div style={{ marginTop: 18 }}>
          <h4>{t.progress.nextFocus}</h4>
          <ul>
            {(progress.learning_graph.next_focus || []).map((item, i) => (
              <li key={i} dir="ltr">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

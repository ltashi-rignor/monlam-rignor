import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import AIChat from '../components/AIChat'
import ProgressChart from '../components/ProgressChart'
import { bo } from '../i18n/bo'
import { useAuthStore } from '../store/authStore'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [progress, setProgress] = useState(null)
  const [recs, setRecs] = useState([])
  const [planTitle, setPlanTitle] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [p, r] = await Promise.all([
          api.getProgress(),
          api.getRecommendations().catch(() => ({ items: [] })),
        ])
        setProgress(p)
        setRecs(r.items || [])
      } catch {
        /* empty */
      }
      try {
        const roadmap = await api.getRoadmap()
        setPlanTitle(roadmap.title)
      } catch {
        setPlanTitle('—')
      }
    })()
  }, [])

  return (
    <div className="tibetan">
      <header className="page-header">
        <div>
          <h1>
            {bo.dashboard.welcome}
            {user?.name ? ` ${user.name}` : ''}
          </h1>
          <p>{bo.dashboard.sub}</p>
        </div>
      </header>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="label">{bo.dashboard.path}</div>
          <div className="value" style={{ fontSize: '1.2rem' }}>
            {planTitle}
          </div>
        </div>
        <div className="stat">
          <div className="label">{bo.dashboard.writing}</div>
          <div className="value" dir="ltr">
            {Math.round(progress?.writing_score || 0)}
          </div>
        </div>
        <div className="stat">
          <div className="label">{bo.dashboard.grammar}</div>
          <div className="value" dir="ltr">
            {Math.round(progress?.grammar_score || 0)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <ProgressChart progress={progress} />
          <div className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0 }}>{bo.dashboard.recommended}</h3>
            {!recs.length && <p className="empty">{bo.dashboard.noRecs}</p>}
            {recs.slice(0, 4).map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <strong>
                  {item.content_type}: {item.title}
                </strong>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)' }} dir="ltr">
                  {item.reason || item.description}
                </p>
              </div>
            ))}
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/grammar">
                {bo.dashboard.checkGrammar}
              </Link>
              <Link className="btn btn-accent" to="/practice">
                {bo.dashboard.todayPractice}
              </Link>
              <Link className="btn btn-ghost" to="/learning-path">
                {bo.dashboard.viewRoadmap}
              </Link>
            </div>
          </div>
        </div>
        <AIChat
          onSend={async (text) => {
            const g = await api.checkGrammar(text)
            return g.corrected_version || ''
          }}
          placeholder={bo.chat.placeholder}
        />
      </div>
    </div>
  )
}

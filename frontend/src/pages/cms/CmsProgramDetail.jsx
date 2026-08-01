import { Navigate, Link, useNavigate, useParams } from 'react-router-dom'
import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'
import { requireAuth } from '../../lib/requireAuth'
import { useAuthStore } from '../../store/authStore'

export default function CmsProgramDetail() {
  const { slug } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const map = {
    alphabet: {
      title: t.cms.programs.alphabetTitle,
      body: t.cms.programs.alphabetLong,
      appPath: '/alphabet',
    },
    vocabulary: {
      title: t.cms.programs.vocabTitle,
      body: t.cms.programs.vocabLong,
      appPath: '/flashcards',
    },
    grammar: {
      title: t.cms.programs.grammarTitle,
      body: t.cms.programs.grammarLong,
      appPath: '/grammar',
    },
  }
  const prog = map[slug]
  if (!prog) return <Navigate to="/programs" replace />

  return (
    <div className="cms-page">
      <div className="cms-wrap cms-prose">
        <Seo title={`${prog.title} · Rignor`} description={prog.body?.slice(0, 140)} />
        <Link to="/programs" className="cms-back">
          ← {t.cms.programs.title}
        </Link>
        <h1>{prog.title}</h1>
        <p className="cms-lead">{prog.body}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => requireAuth(navigate, user, prog.appPath)}
        >
          {t.cms.programs.openTool}
        </button>
      </div>
    </div>
  )
}

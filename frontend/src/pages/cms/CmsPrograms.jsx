import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'
import { requireAuth } from '../../lib/requireAuth'
import { useAuthStore } from '../../store/authStore'

export default function CmsPrograms() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const programs = useMemo(
    () => [
      {
        slug: 'alphabet',
        title: t.cms.programs.alphabetTitle,
        body: t.cms.programs.alphabetBody,
        appPath: '/alphabet',
      },
      {
        slug: 'vocabulary',
        title: t.cms.programs.vocabTitle,
        body: t.cms.programs.vocabBody,
        appPath: '/flashcards',
      },
      {
        slug: 'grammar',
        title: t.cms.programs.grammarTitle,
        body: t.cms.programs.grammarBody,
        appPath: '/grammar',
      },
    ],
    [t],
  )

  return (
    <div className="cms-page">
      <div className="cms-wrap">
        <Seo title={t.cms.programs.seoTitle} description={t.cms.programs.seoDesc} />
        <p className="cms-eyebrow">{t.cms.programs.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.programs.title}</h1>
        <p className="cms-lead">{t.cms.programs.lead}</p>
        <div className="cms-program-list">
          {programs.map((p) => (
            <article key={p.slug} className="cms-program-card">
              <div>
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
              <div className="cms-program-actions">
                <Link to={`/programs/${p.slug}`} className="btn btn-ghost">
                  {t.cms.programs.learnMore}
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => requireAuth(navigate, user, p.appPath)}
                >
                  {t.cms.programs.openTool}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

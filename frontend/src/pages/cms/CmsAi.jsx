import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'
import { requireAuth } from '../../lib/requireAuth'
import { useAuthStore } from '../../store/authStore'

export default function CmsAi() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const tools = useMemo(
    () => [
      { title: t.cms.ai.tutor, body: t.cms.ai.tutorBody, path: '/tutor' },
      { title: t.cms.ai.grammar, body: t.cms.ai.grammarBody, path: '/grammar' },
      { title: t.cms.ai.story, body: t.cms.ai.storyBody, path: '/story' },
      { title: t.cms.ai.practice, body: t.cms.ai.practiceBody, path: '/practice' },
    ],
    [t],
  )

  return (
    <div className="cms-page">
      <div className="cms-wrap">
        <Seo title={t.cms.ai.seoTitle} description={t.cms.ai.seoDesc} />
        <p className="cms-eyebrow">{t.cms.ai.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.ai.title}</h1>
        <p className="cms-lead">{t.cms.ai.lead}</p>
        <div className="cms-feature-grid">
          {tools.map((tool) => (
            <button
              key={tool.path}
              type="button"
              className="cms-feature-link cms-feature-btn"
              onClick={() => requireAuth(navigate, user, tool.path)}
            >
              <h3>{tool.title}</h3>
              <p>{tool.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

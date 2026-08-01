import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'

export default function CmsFeatures() {
  const { t } = useI18n()
  const items = useMemo(
    () => [
      { title: t.cms.features.alphabet, body: t.cms.features.alphabetBody, to: '/programs/alphabet' },
      { title: t.cms.features.vocab, body: t.cms.features.vocabBody, to: '/programs/vocabulary' },
      { title: t.cms.features.grammar, body: t.cms.features.grammarBody, to: '/programs/grammar' },
      { title: t.cms.features.handwriting, body: t.cms.features.handwritingBody, to: '/programs/alphabet' },
      { title: t.cms.features.games, body: t.cms.features.gamesBody, to: '/programs' },
      { title: t.cms.features.ai, body: t.cms.features.aiBody, to: '/ai' },
      { title: t.cms.features.path, body: t.cms.features.pathBody, to: '/programs' },
      { title: t.cms.features.progress, body: t.cms.features.progressBody, to: '/features' },
    ],
    [t],
  )

  return (
    <div className="cms-page">
      <div className="cms-wrap">
        <Seo title={t.cms.features.seoTitle} description={t.cms.features.seoDesc} />
        <p className="cms-eyebrow">{t.cms.features.eyebrow}</p>
        <h1 className="cms-page-title">{t.cms.features.title}</h1>
        <p className="cms-lead">{t.cms.features.lead}</p>
        <div className="cms-feature-grid cms-feature-grid-lg">
          {items.map((item) => (
            <Link key={item.title} to={item.to} className="cms-feature-link">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

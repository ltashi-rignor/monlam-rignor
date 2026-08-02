import Seo from '../../components/Seo'
import { useI18n } from '../../i18n/useI18n'

export default function CmsAbout() {
  const { t } = useI18n()
  return (
    <div className="cms-page">
      <div className="cms-wrap cms-prose">
        <Seo title={t.cms.about.seoTitle} description={t.cms.about.seoDesc} />
        <p className="">{t.cms.about.eyebrow}</p>
        <h1>རིག་ནོར།</h1>
        <p className="cms-lead">{t.cms.about.lead}</p>
        <h2>{t.cms.about.missionTitle}</h2>
        <p>{t.cms.about.mission}</p>
        <h2>{t.cms.about.whoTitle}</h2>
        <p>{t.cms.about.who}</p>
        <h2>{t.cms.about.howTitle}</h2>
        <p>{t.cms.about.how}</p>
      </div>
    </div>
  )
}

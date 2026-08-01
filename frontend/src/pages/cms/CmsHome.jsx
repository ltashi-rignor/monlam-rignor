import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../api/client'
import AnimatedCounter from '../../components/AnimatedCounter'
import Seo from '../../components/Seo'
import { postTitle, useI18n } from '../../i18n/useI18n'
import { requireAuth } from '../../lib/requireAuth'
import { useAuthStore } from '../../store/authStore'

export default function CmsHome() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState({ learners: 128, letters: 30, grammar_topics: 48, ai_lessons: 12 })
  const [announcements, setAnnouncements] = useState([])

  const features = useMemo(
    () => [
      { to: '/programs/alphabet', title: t.cms.home.fAlphabet, desc: t.cms.home.fAlphabetDesc },
      { to: '/programs/vocabulary', title: t.cms.home.fVocab, desc: t.cms.home.fVocabDesc },
      { to: '/programs/grammar', title: t.cms.home.fGrammar, desc: t.cms.home.fGrammarDesc },
      { to: '/ai', title: t.cms.home.fAi, desc: t.cms.home.fAiDesc },
    ],
    [t],
  )

  useEffect(() => {
    api.cmsStats().then(setStats).catch(() => {})
    api.cmsAnnouncements(3).then(setAnnouncements).catch(() => {})
  }, [])

  return (
    <div className="cms-page cms-home">
      <Seo title={t.cms.home.seoTitle} description={t.cms.home.seoDesc} />

      <section className="cms-hero">
        <div className="cms-hero-bg" aria-hidden />
        <div className="cms-wrap cms-hero-inner">
          <motion.div
            className="cms-hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <p className="cms-eyebrow">{t.cms.home.eyebrow}</p>
            <h1 className="cms-hero-brand">རིག་ནོར།</h1>
            <p className="cms-hero-lead">{t.cms.home.lead}</p>
            <div className="cms-hero-cta">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => requireAuth(navigate, user, '/dashboard')}
              >
                {t.cms.nav.start}
              </button>
              <Link to="/programs" className="btn btn-ghost">
                {t.cms.home.explorePrograms}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="cms-wrap">
        <section className="cms-section cms-stats-row">
          <div className="cms-stat">
            <AnimatedCounter value={stats.learners} />
            <span>{t.cms.home.statLearners}</span>
          </div>
          <div className="cms-stat">
            <AnimatedCounter value={stats.letters} />
            <span>{t.cms.home.statLetters}</span>
          </div>
          <div className="cms-stat">
            <AnimatedCounter value={stats.grammar_topics} />
            <span>{t.cms.home.statGrammar}</span>
          </div>
          <div className="cms-stat">
            <AnimatedCounter value={stats.ai_lessons} />
            <span>{t.cms.home.statAi}</span>
          </div>
        </section>

        <section className="cms-section">
          <h2>{t.cms.home.featuresTitle}</h2>
          <p className="cms-section-lead">{t.cms.home.featuresLead}</p>
          <div className="cms-feature-grid">
            {features.map((f, i) => (
              <motion.div
                key={f.to}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={f.to} className="cms-feature-link">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {announcements.length > 0 && (
          <section className="cms-section">
            <h2>{t.cms.home.announceTitle}</h2>
            <ul className="cms-announce-list">
              {announcements.map((a) => (
                <li key={a.id}>
                  <strong>{postTitle(a, lang)}</strong>
                  <span className="muted">{a.excerpt || a.body}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cms-section cms-cta-band">
          <h2>{t.cms.home.ctaTitle}</h2>
          <p>{t.cms.home.ctaLead}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => requireAuth(navigate, user, '/alphabet')}
          >
            {t.cms.home.ctaAlphabet}
          </button>
        </section>
      </div>
    </div>
  )
}

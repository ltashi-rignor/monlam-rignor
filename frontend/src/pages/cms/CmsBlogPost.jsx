import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import Seo from '../../components/Seo'
import { postTitle, useI18n } from '../../i18n/useI18n'

export default function CmsBlogPost() {
  const { slug } = useParams()
  const { t, lang } = useI18n()
  const [post, setPost] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .cmsPost('blog', slug)
      .then(setPost)
      .catch((e) => setErr(e.message))
  }, [slug])

  if (err) {
    return (
      <div className="cms-page">
        <div className="cms-wrap">
          <p className="error">{err}</p>
          <Link to="/blog">{t.cms.blog.title}</Link>
        </div>
      </div>
    )
  }
  if (!post) {
    return (
      <div className="cms-page">
        <div className="cms-wrap muted">{t.loading}</div>
      </div>
    )
  }

  const title = postTitle(post, lang)
  return (
    <div className="cms-page">
      <div className="cms-wrap cms-prose">
        <Seo title={`${title} · Rignor`} description={post.excerpt || post.body?.slice(0, 140)} />
        <Link to="/blog" className="cms-back">
          ← {t.cms.blog.title}
        </Link>
        <h1>{title}</h1>
        <div className="cms-article-body">{post.body}</div>
      </div>
    </div>
  )
}

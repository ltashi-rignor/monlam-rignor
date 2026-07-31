import { useEffect, useState } from 'react'
import { api } from '../api/client'
import Roadmap from '../components/Roadmap'
import { bo } from '../i18n/bo'

export default function LearningPath() {
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const data = await api.getRoadmap()
      setPlan(data)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function regenerate() {
    setBusy(true)
    setError('')
    try {
      const data = await api.generateRoadmap(true)
      setPlan(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tibetan">
      <header className="page-header">
        <div>
          <h1>{bo.learningPath.title}</h1>
          <p>{bo.learningPath.sub}</p>
        </div>
        <button className="btn btn-primary" onClick={regenerate} disabled={busy}>
          {busy ? bo.learningPath.regenerating : bo.learningPath.regenerate}
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <Roadmap plan={plan} />
    </div>
  )
}

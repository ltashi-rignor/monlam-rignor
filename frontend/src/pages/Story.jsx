import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import WorkingProgress from '../components/WorkingProgress'
import { useI18n } from '../i18n/useI18n'
import { sceneArt } from '../lib/storyScenes'

function blankNames(n) {
  return Array.from({ length: n }, () => '')
}

export default function Story() {
  const { t, isEn, lang } = useI18n()
  const [characterCount, setCharacterCount] = useState(2)
  const [names, setNames] = useState(() => blankNames(2))
  const [actions, setActions] = useState('')
  const [setting, setSetting] = useState('')
  const [story, setStory] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeScene, setActiveScene] = useState(0)

  const stages = useMemo(
    () => [t.story.stage1, t.story.stage2, t.story.stage3],
    [t.story.stage1, t.story.stage2, t.story.stage3],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await api.storyHistory()
        if (!cancelled) setHistory(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setHistory([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function onCountChange(n) {
    const count = Math.max(1, Math.min(5, Number(n) || 1))
    setCharacterCount(count)
    setNames((prev) => {
      const next = blankNames(count)
      for (let i = 0; i < count; i += 1) next[i] = prev[i] || ''
      return next
    })
  }

  function setNameAt(i, value) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)))
  }

  async function onGenerate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api.generateStory({
        character_count: characterCount,
        character_names: names.map((n) => n.trim()).filter(Boolean),
        actions: actions.trim(),
        setting: setting.trim() || null,
      })
      setStory(data)
      setActiveScene(0)
      setHistory((prev) => [data, ...prev.filter((h) => h.id !== data.id)].slice(0, 12))
    } catch (err) {
      setError(err.message || t.story.retry)
    } finally {
      setBusy(false)
    }
  }

  function openHistory(row) {
    setStory(row)
    setActiveScene(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scenes = story?.scenes || []
  const current = scenes[activeScene]

  return (
    <div className={`story-page ${isEn ? 'is-en' : 'tibetan'}`} lang={lang}>
      <header className="page-header">
        <div>
          <h1>{t.story.title}</h1>
          <p>{t.story.sub}</p>
        </div>
      </header>

      <div className="story-layout">
        <form className="panel story-form" onSubmit={onGenerate}>
          <div className="field">
            <label htmlFor="story-count">{t.story.characterCount}</label>
            <select
              id="story-count"
              value={characterCount}
              onChange={(e) => onCountChange(e.target.value)}
              disabled={busy}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="story-names">
            <span className="story-names-label">{t.story.characterNames}</span>
            {names.map((name, i) => (
              <div className="field" key={`name-${i}`}>
                <label htmlFor={`story-name-${i}`}>
                  {t.story.characterN} <span dir="ltr">{i + 1}</span>
                </label>
                <input
                  id={`story-name-${i}`}
                  value={name}
                  onChange={(e) => setNameAt(i, e.target.value)}
                  placeholder={t.story.namePh}
                  maxLength={40}
                  disabled={busy}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label htmlFor="story-actions">{t.story.actions}</label>
            <textarea
              id="story-actions"
              rows={3}
              required
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              placeholder={t.story.actionsPh}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="story-setting">{t.story.setting}</label>
            <input
              id="story-setting"
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              placeholder={t.story.settingPh}
              maxLength={200}
              disabled={busy}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <WorkingProgress
            active={busy}
            title={t.story.generating}
            stages={stages}
            compact
          />

          <button className="btn btn-primary" type="submit" disabled={busy || !actions.trim()}>
            {busy ? t.story.generating : t.story.generate}
          </button>
        </form>

        <div className="story-result-col">
          {!story && !busy && (
            <div className="panel story-empty">
              <div className="story-empty-art" aria-hidden>
                📖 ✨ 🏔️
              </div>
              <p>{t.story.empty}</p>
            </div>
          )}

          {story && (
            <section className="panel story-book">
              <header className="story-book-head">
                <h2>{story.title}</h2>
                {!!story.characters_used?.length && (
                  <p className="story-cast">
                    {t.story.cast}: {story.characters_used.join(' · ')}
                  </p>
                )}
              </header>

              {current && (
                <article className="story-scene" key={`${story.id}-${activeScene}`}>
                  <div className="story-scene-art" aria-hidden>
                    <span className="story-scene-emoji">{sceneArt(current.scene_key, isEn).emoji}</span>
                    <span className="story-scene-tag">
                      {current.caption || sceneArt(current.scene_key, isEn).label}
                    </span>
                  </div>
                  <p className="story-scene-text">{current.text}</p>
                </article>
              )}

              {scenes.length > 1 && (
                <div className="story-scene-nav" dir="ltr">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={activeScene <= 0}
                    onClick={() => setActiveScene((s) => Math.max(0, s - 1))}
                  >
                    ←
                  </button>
                  <div className="story-dots" role="tablist" aria-label={t.story.scenes}>
                    {scenes.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`story-dot${i === activeScene ? ' is-active' : ''}`}
                        aria-label={`${i + 1}`}
                        onClick={() => setActiveScene(i)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={activeScene >= scenes.length - 1}
                    onClick={() => setActiveScene((s) => Math.min(scenes.length - 1, s + 1))}
                  >
                    →
                  </button>
                </div>
              )}

              {story.moral && (
                <div className="story-moral">
                  <strong>{t.story.moral}</strong>
                  <p>{story.moral}</p>
                </div>
              )}

              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  setStory(null)
                  setActiveScene(0)
                }}
              >
                {t.story.newStory}
              </button>
            </section>
          )}

          <aside className="panel story-history">
            <h3>{t.story.history}</h3>
            {!history.length && <p className="muted">{t.story.historyEmpty}</p>}
            <ul className="story-history-list">
              {history.map((row) => (
                <li key={row.id}>
                  <button type="button" className="story-history-item" onClick={() => openHistory(row)}>
                    <strong>{row.title || t.story.untitled}</strong>
                    <span className="muted" dir="ltr">
                      {(row.scenes || []).length} {t.story.scenes}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}

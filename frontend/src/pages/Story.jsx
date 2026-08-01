import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import SpeakDrill, { drillsFromStory } from '../components/SpeakDrill'
import VoicePicker from '../components/VoicePicker'
import WorkingProgress from '../components/WorkingProgress'
import { useTibetanVoice } from '../hooks/useTibetanVoice'
import { useI18n } from '../i18n/useI18n'
import { sceneArt } from '../lib/storyScenes'

function blankNames(n) {
  return Array.from({ length: n }, () => '')
}

function tokenizeTibetan(text) {
  const raw = String(text || '')
  const parts = []
  const re = /([\u0F00-\u0FFF]+|[^\u0F00-\u0FFF]+)/g
  let m
  while ((m = re.exec(raw))) {
    parts.push(m[0])
  }
  return parts.length ? parts : [raw]
}

function isTibetanToken(tok) {
  return /[\u0F00-\u0FFF]/.test(tok) && tok.replace(/[་།༎\s]/g, '').length > 0
}

export default function Story() {
  const { t, isEn, lang } = useI18n()
  const { voice, setVoice, speak, stop, loading: ttsBusy } = useTibetanVoice()
  const [characterCount, setCharacterCount] = useState(2)
  const [names, setNames] = useState(() => blankNames(2))
  const [actions, setActions] = useState('')
  const [setting, setSetting] = useState('')
  const [story, setStory] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeScene, setActiveScene] = useState(0)
  const [mode, setMode] = useState('speak') // speak | read | quiz
  const [quizStep, setQuizStep] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizDone, setQuizDone] = useState(false)
  const [wordTip, setWordTip] = useState(null)
  const [defineBusy, setDefineBusy] = useState(false)

  const stages = useMemo(
    () => [t.story.stage1, t.story.stage2, t.story.stage3],
    [t.story.stage1, t.story.stage2, t.story.stage3],
  )

  const glossaryMap = useMemo(() => {
    const map = {}
    for (const g of story?.glossary || []) {
      if (g?.word) map[g.word] = g.meaning
    }
    return map
  }, [story])

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
      stop()
    }
  }, [stop])

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

  function resetReading(data) {
    setStory(data)
    setActiveScene(0)
    setMode('speak')
    setQuizStep(0)
    setQuizAnswers({})
    setQuizDone(false)
    setWordTip(null)
    stop()
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
      resetReading(data)
      setHistory((prev) => [data, ...prev.filter((h) => h.id !== data.id)].slice(0, 12))
    } catch (err) {
      setError(err.message || t.story.retry)
    } finally {
      setBusy(false)
    }
  }

  function openHistory(row) {
    resetReading(row)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onTapWord(raw) {
    const word = String(raw || '').replace(/[་།༎\s]+$/g, '').trim()
    if (!word) return
    const fromGlossary = glossaryMap[word] || glossaryMap[`${word}་`]
    if (fromGlossary) {
      setWordTip({ word, meaning: fromGlossary, example: '' })
      speak(word)
      return
    }
    setDefineBusy(true)
    setWordTip({ word, meaning: t.story.defining, example: '' })
    try {
      const data = await api.defineStoryWord(word)
      setWordTip({
        word: data.word || word,
        meaning: data.meaning || t.story.defineFail,
        example: data.example || '',
      })
      speak(word)
    } catch {
      setWordTip({ word, meaning: t.story.defineFail, example: '' })
    } finally {
      setDefineBusy(false)
    }
  }

  const scenes = story?.scenes || []
  const current = scenes[activeScene]
  const quiz = story?.quiz || []
  const quizItem = quiz[quizStep]
  const speakDrills = useMemo(() => drillsFromStory(story), [story])
  const quizScore = useMemo(() => {
    if (!quiz.length) return 0
    let ok = 0
    quiz.forEach((q, i) => {
      if (quizAnswers[i] && quizAnswers[i] === q.answer) ok += 1
    })
    return ok
  }, [quiz, quizAnswers])

  return (
    <div className={`story-page ${isEn ? 'is-en' : 'tibetan'}`} lang={lang}>
      <header className="page-header">
        <div>
          <h1>{t.story.title}</h1>
          <p>{t.story.sub}</p>
        </div>
        <VoicePicker value={voice} onChange={setVoice} />
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
          <WorkingProgress active={busy} title={t.story.generating} stages={stages} compact />
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
                <div className="story-mode-tabs" role="tablist">
                  <button
                    type="button"
                    className={mode === 'speak' ? 'is-active' : ''}
                    onClick={() => setMode('speak')}
                    disabled={!speakDrills.length}
                  >
                    {t.story.speakMode}
                  </button>
                  <button
                    type="button"
                    className={mode === 'read' ? 'is-active' : ''}
                    onClick={() => setMode('read')}
                  >
                    {t.story.readMode}
                  </button>
                  <button
                    type="button"
                    className={mode === 'quiz' ? 'is-active' : ''}
                    onClick={() => setMode('quiz')}
                    disabled={!quiz.length}
                  >
                    {t.story.quizMode}
                  </button>
                </div>
              </header>

              {mode === 'speak' && (
                <div className="story-speak-wrap">
                  <p className="muted story-speak-hint">{t.story.speakHint}</p>
                  <SpeakDrill
                    drills={speakDrills}
                    voiceApi={{ speak, stop, loading: ttsBusy }}
                  />
                </div>
              )}

              {mode === 'read' && current && (
                <article className="story-scene" key={`${story.id}-${activeScene}`}>
                  <div className="story-scene-art" aria-hidden>
                    <span className="story-scene-emoji">{sceneArt(current.scene_key, isEn).emoji}</span>
                    <span className="story-scene-tag">
                      {current.caption || sceneArt(current.scene_key, isEn).label}
                    </span>
                  </div>
                  <p className="story-scene-text story-tappable">
                    {tokenizeTibetan(current.text).map((tok, i) =>
                      isTibetanToken(tok) ? (
                        <button
                          key={`${i}-${tok}`}
                          type="button"
                          className="story-word"
                          onClick={() => onTapWord(tok)}
                        >
                          {tok}
                        </button>
                      ) : (
                        <span key={`${i}-${tok}`}>{tok}</span>
                      ),
                    )}
                  </p>
                  <div className="story-scene-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={ttsBusy}
                      onClick={() => {
                        const line = String(current.text || '').trim()
                        if (line) speak(line)
                      }}
                    >
                      {t.story.listen}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => stop()}>
                      {t.story.stopAudio}
                    </button>
                  </div>
                  <p className="muted story-tap-hint">{t.story.tapWord}</p>
                </article>
              )}

              {mode === 'read' && scenes.length > 1 && (
                <div className="story-scene-nav" dir="ltr">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={activeScene <= 0}
                    onClick={() => setActiveScene((s) => Math.max(0, s - 1))}
                  >
                    ←
                  </button>
                  <div className="story-dots">
                    {scenes.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`story-dot${i === activeScene ? ' is-active' : ''}`}
                        onClick={() => setActiveScene(i)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={activeScene >= scenes.length - 1}
                    onClick={() => {
                      if (activeScene >= scenes.length - 1) return
                      setActiveScene((s) => s + 1)
                    }}
                  >
                    →
                  </button>
                </div>
              )}

              {mode === 'read' && activeScene >= scenes.length - 1 && speakDrills.length > 0 && (
                <button type="button" className="btn btn-accent" onClick={() => setMode('speak')}>
                  {t.story.practiceSpeak}
                </button>
              )}

              {mode === 'read' && activeScene >= scenes.length - 1 && quiz.length > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setMode('quiz')}>
                  {t.story.startQuiz}
                </button>
              )}

              {mode === 'quiz' && quizItem && !quizDone && (
                <div className="story-quiz panel-inset">
                  <p className="story-quiz-meta" dir="ltr">
                    {quizStep + 1}/{quiz.length}
                  </p>
                  <h3>{quizItem.prompt}</h3>
                  <div className="story-quiz-options">
                    {(quizItem.options || []).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`story-quiz-opt ${quizAnswers[quizStep] === opt ? 'is-on' : ''}`}
                        onClick={() => setQuizAnswers((a) => ({ ...a, [quizStep]: opt }))}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!quizAnswers[quizStep]}
                    onClick={() => {
                      if (quizStep >= quiz.length - 1) setQuizDone(true)
                      else setQuizStep((s) => s + 1)
                    }}
                  >
                    {quizStep >= quiz.length - 1 ? t.story.finishQuiz : t.story.nextQuiz}
                  </button>
                </div>
              )}

              {mode === 'quiz' && quizDone && (
                <div className="story-quiz-result">
                  <h3>{t.story.quizDone}</h3>
                  <p dir="ltr">
                    {quizScore}/{quiz.length}
                  </p>
                  <button type="button" className="btn btn-ghost" onClick={() => setMode('read')}>
                    {t.story.readMode}
                  </button>
                </div>
              )}

              {wordTip && (
                <div className="story-word-tip" role="status">
                  <strong>{wordTip.word}</strong>
                  <p>{defineBusy && wordTip.meaning === t.story.defining ? t.story.defining : wordTip.meaning}</p>
                  {wordTip.example ? <p className="muted">{wordTip.example}</p> : null}
                  <button type="button" className="btn btn-ghost" onClick={() => setWordTip(null)}>
                    {t.story.closeTip}
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
                  stop()
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

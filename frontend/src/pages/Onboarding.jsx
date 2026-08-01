import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useI18n } from '../i18n/useI18n'
import {
  ABILITY_SKILLS,
  ALPHABET_OPTIONS,
  CHALLENGE_OPTIONS,
  DIFFICULTY_OPTIONS,
  GOAL_OPTIONS,
  GRAMMAR_KEYS,
  INTEREST_OPTIONS,
  LESSON_LENGTH_OPTIONS,
  MOTIVATION_OPTIONS,
  NATIVE_LANG_OPTIONS,
  PRONUNCIATION_OPTIONS,
  SCRIPT_OPTIONS,
  STEPS,
  STYLE_OPTIONS,
  TIME_OPTIONS,
  VARIETY_OPTIONS,
  VOCAB_OPTIONS,
  profileFromUser,
  scorePlacement,
  stepValid,
  toggleInList,
} from '../lib/learnerProfileOptions'
import { useAuthStore } from '../store/authStore'

function ChipGroup({ options, value, onChange, multi, labelFn, columns = 2 }) {
  const selected = multi ? value || [] : value
  return (
    <div className={`chip-grid chip-grid-${columns}`}>
      {options.map((opt) => {
        const active = multi ? selected.includes(opt) : selected === opt
        return (
          <button
            key={opt}
            type="button"
            className={`chip-select${active ? ' is-active' : ''}`}
            onClick={() => {
              if (multi) onChange(toggleInList(selected, opt))
              else onChange(opt)
            }}
          >
            {labelFn(opt)}
          </button>
        )
      })}
    </div>
  )
}

function AbilityRow({ skill, value, onChange, t }) {
  const labels = t.onboarding.abilityLevels
  return (
    <div className="ability-row">
      <div className="ability-label">{t.onboarding.skills[skill]}</div>
      <div className="ability-options">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`chip-select${value === n ? ' is-active' : ''}`}
            onClick={() => onChange(n)}
          >
            {labels[skill][n]}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Onboarding() {
  const { t, lang, setLang, isEn } = useI18n()
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const navigate = useNavigate()
  const editing = Boolean(user?.profile_complete)

  const [stepIdx, setStepIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [regeneratePlan, setRegeneratePlan] = useState(true)
  const [name, setName] = useState(user?.name || '')
  const [age, setAge] = useState(user?.age ?? '')
  const [profile, setProfile] = useState(() => profileFromUser(user))
  const [placementAnswers, setPlacementAnswers] = useState({
    letter: '',
    vocab: '',
    particle: '',
    read: '',
    write: '',
  })

  const step = STEPS[stepIdx]
  const o = t.onboarding
  const opt = o.opts || {}

  const label = (group, key) => opt?.[group]?.[key] || key

  const progressPct = Math.round(((stepIdx + 1) / STEPS.length) * 100)

  const copy = useMemo(
    () => ({
      title: editing ? o.editTitle : o.title,
      sub: editing ? o.editSub : o.sub,
    }),
    [editing, o],
  )

  function patchProfile(patch) {
    setProfile((p) => ({ ...p, ...patch }))
  }

  function patchNested(key, nested) {
    setProfile((p) => ({ ...p, [key]: { ...(p[key] || {}), ...nested } }))
  }

  function canNext() {
    return stepValid(step, { name }, profile)
  }

  async function finish() {
    setBusy(true)
    setError('')
    setStatus(o.saving)
    try {
      const placement = scorePlacement(placementAnswers)
      const learner_profile = {
        ...profile,
        placement:
          placementAnswers.letter || placementAnswers.vocab
            ? placement
            : profile.placement,
      }
      await api.updateProfile({
        name: name.trim(),
        age: age === '' || age === null ? undefined : Number(age),
        learner_profile,
      })

      const shouldPlan = !editing || regeneratePlan
      if (shouldPlan) {
        setStatus(o.planning)
        try {
          await api.generateRoadmap(editing)
        } catch (roadmapErr) {
          setError(roadmapErr.message)
          await refreshUser()
          navigate('/dashboard')
          return
        }
      }

      await refreshUser()
      navigate(editing ? '/learning-path' : '/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  function next() {
    if (!canNext()) {
      setError(o.needFields)
      return
    }
    setError('')
    if (stepIdx >= STEPS.length - 1) {
      finish()
      return
    }
    setStepIdx((i) => i + 1)
  }

  function back() {
    setError('')
    setStepIdx((i) => Math.max(0, i - 1))
  }

  return (
    <div className={`auth-screen profile-wizard ${isEn ? 'is-en' : 'tibetan'}`}>
      <section className="auth-hero">
        <div className="auth-hero-top">
          <div className="cms-lang auth-lang" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === 'bo' ? 'is-active' : ''}
              onClick={() => setLang('bo')}
            >
              བོད།
            </button>
            <button
              type="button"
              className={lang === 'en' ? 'is-active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>
        <div className="auth-hero-brand">
          <p className="auth-eyebrow">{t.brand}</p>
          <h1>{copy.title}</h1>
          <p className="auth-hero-sub">{o.stepSubs[step] || copy.sub}</p>
          <ol className="profile-hero-steps" aria-label={o.title}>
            {STEPS.map((key, i) => (
              <li key={key} className={i === stepIdx ? 'is-active' : i < stepIdx ? 'is-done' : ''}>
                <span className="profile-hero-step-num" dir="ltr">
                  {i + 1}
                </span>
                <span className="profile-hero-step-label">{o.steps[key]}</span>
              </li>
            ))}
          </ol>
          {editing ? (
            <Link to="/dashboard" className="auth-back-home">
              ← {o.back}
            </Link>
          ) : (
            <Link to="/" className="auth-back-home">
              ← {t.cms.nav.home}
            </Link>
          )}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card panel profile-card">
          <div className="profile-progress" aria-hidden>
            <div className="profile-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="profile-step-meta" dir="ltr">
            {stepIdx + 1} / {STEPS.length}
          </p>
          <h2>{o.steps[step]}</h2>
          <p className="sub">{o.stepSubs[step] || copy.sub}</p>

          {step === 'basics' && (
            <div className="profile-step">
              <div className="field">
                <label>{o.name}</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>
                  {o.age} <span className="muted">({o.optional})</span>
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  dir="ltr"
                />
              </div>
              <fieldset className="profile-fieldset">
                <legend>{o.goalsTitle}</legend>
                <ChipGroup
                  multi
                  options={GOAL_OPTIONS}
                  value={profile.goals}
                  onChange={(goals) => patchProfile({ goals })}
                  labelFn={(k) => label('goals', k)}
                  columns={2}
                />
                {profile.goals.includes('other') && (
                  <input
                    className="mt-8"
                    value={profile.goal_other}
                    onChange={(e) => patchProfile({ goal_other: e.target.value })}
                    placeholder={o.goalOtherPh}
                  />
                )}
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.varietyTitle}</legend>
                <ChipGroup
                  options={VARIETY_OPTIONS}
                  value={profile.tibetan_variety}
                  onChange={(tibetan_variety) => patchProfile({ tibetan_variety })}
                  labelFn={(k) => label('variety', k)}
                  columns={2}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.nativeTitle}</legend>
                <ChipGroup
                  options={NATIVE_LANG_OPTIONS}
                  value={profile.native_language}
                  onChange={(native_language) => patchProfile({ native_language })}
                  labelFn={(k) => label('native', k)}
                  columns={2}
                />
                {profile.native_language === 'other' && (
                  <input
                    className="mt-8"
                    value={profile.native_language_other}
                    onChange={(e) =>
                      patchProfile({ native_language_other: e.target.value })
                    }
                    placeholder={o.nativeOtherPh}
                  />
                )}
              </fieldset>
            </div>
          )}

          {step === 'ability' && (
            <div className="profile-step">
              <p className="muted">{o.abilityHint}</p>
              {ABILITY_SKILLS.map((skill) => (
                <AbilityRow
                  key={skill}
                  skill={skill}
                  value={profile.ability[skill]}
                  onChange={(n) => patchNested('ability', { [skill]: n })}
                  t={t}
                />
              ))}
            </div>
          )}

          {step === 'script' && (
            <div className="profile-step">
              <fieldset className="profile-fieldset">
                <legend>{o.scriptsTitle}</legend>
                <ChipGroup
                  multi
                  options={SCRIPT_OPTIONS}
                  value={profile.scripts}
                  onChange={(scripts) => {
                    // neither is exclusive
                    if (scripts.includes('neither') && scripts[scripts.length - 1] === 'neither') {
                      patchProfile({ scripts: ['neither'] })
                    } else {
                      patchProfile({ scripts: scripts.filter((s) => s !== 'neither') })
                    }
                  }}
                  labelFn={(k) => label('scripts', k)}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.alphabetTitle}</legend>
                <ChipGroup
                  multi
                  options={ALPHABET_OPTIONS}
                  value={profile.alphabet}
                  onChange={(alphabet) => patchProfile({ alphabet })}
                  labelFn={(k) => label('alphabet', k)}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.vocabTitle}</legend>
                <ChipGroup
                  options={VOCAB_OPTIONS}
                  value={profile.vocabulary_size}
                  onChange={(vocabulary_size) => patchProfile({ vocabulary_size })}
                  labelFn={(k) => label('vocab', k)}
                  columns={3}
                />
              </fieldset>
            </div>
          )}

          {step === 'knowledge' && (
            <div className="profile-step">
              <fieldset className="profile-fieldset">
                <legend>{o.grammarTitle}</legend>
                {GRAMMAR_KEYS.map((key) => (
                  <div key={key} className="ability-row compact">
                    <div className="ability-label">{label('grammar', key)}</div>
                    <div className="ability-options">
                      {[0, 1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`chip-select${profile.grammar_confidence[key] === n ? ' is-active' : ''}`}
                          onClick={() => patchNested('grammar_confidence', { [key]: n })}
                        >
                          {o.confidence[n]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.pronunciationTitle}</legend>
                <ChipGroup
                  multi
                  options={PRONUNCIATION_OPTIONS}
                  value={profile.pronunciation}
                  onChange={(pronunciation) => patchProfile({ pronunciation })}
                  labelFn={(k) => label('pronunciation', k)}
                />
              </fieldset>
            </div>
          )}

          {step === 'interests' && (
            <div className="profile-step">
              <fieldset className="profile-fieldset">
                <legend>{o.interestsTitle}</legend>
                <ChipGroup
                  multi
                  options={INTEREST_OPTIONS}
                  value={profile.interests}
                  onChange={(interests) => patchProfile({ interests })}
                  labelFn={(k) => label('interests', k)}
                  columns={2}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.motivationsTitle}</legend>
                <ChipGroup
                  multi
                  options={MOTIVATION_OPTIONS}
                  value={profile.motivations}
                  onChange={(motivations) => patchProfile({ motivations })}
                  labelFn={(k) => label('motivations', k)}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.challengesTitle}</legend>
                <ChipGroup
                  multi
                  options={CHALLENGE_OPTIONS}
                  value={profile.challenges}
                  onChange={(challenges) => patchProfile({ challenges })}
                  labelFn={(k) => label('challenges', k)}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.stylesTitle}</legend>
                <ChipGroup
                  multi
                  options={STYLE_OPTIONS}
                  value={profile.learning_styles}
                  onChange={(learning_styles) => patchProfile({ learning_styles })}
                  labelFn={(k) => label('styles', k)}
                />
              </fieldset>
            </div>
          )}

          {step === 'schedule' && (
            <div className="profile-step">
              <fieldset className="profile-fieldset">
                <legend>{o.dailyTitle}</legend>
                <ChipGroup
                  options={TIME_OPTIONS}
                  value={profile.daily_minutes}
                  onChange={(daily_minutes) => patchProfile({ daily_minutes })}
                  labelFn={(k) => label('daily', String(k))}
                  columns={3}
                />
              </fieldset>
              <div className="field">
                <label>{o.weeklyGoal}</label>
                <input
                  value={profile.weekly_goal}
                  onChange={(e) => patchProfile({ weekly_goal: e.target.value })}
                  placeholder={o.weeklyGoalPh}
                />
              </div>
              <fieldset className="profile-fieldset">
                <legend>{o.difficultyTitle}</legend>
                <ChipGroup
                  options={DIFFICULTY_OPTIONS}
                  value={profile.difficulty}
                  onChange={(difficulty) => patchProfile({ difficulty })}
                  labelFn={(k) => label('difficulty', k)}
                />
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.lessonLengthTitle}</legend>
                <ChipGroup
                  options={LESSON_LENGTH_OPTIONS}
                  value={profile.lesson_minutes}
                  onChange={(lesson_minutes) => patchProfile({ lesson_minutes })}
                  labelFn={(k) => `${k} ${o.minutes}`}
                  columns={3}
                />
              </fieldset>
            </div>
          )}

          {step === 'prefs' && (
            <div className="profile-step">
              <fieldset className="profile-fieldset">
                <legend>{o.aiPrefsTitle}</legend>
                <div className="field">
                  <label>{o.mistakeTiming}</label>
                  <ChipGroup
                    options={['immediate', 'end']}
                    value={profile.ai_prefs.mistake_timing}
                    onChange={(mistake_timing) =>
                      patchNested('ai_prefs', { mistake_timing })
                    }
                    labelFn={(k) => label('mistakeTiming', k)}
                  />
                </div>
                <div className="field">
                  <label>{o.feedbackStyle}</label>
                  <ChipGroup
                    options={['gentle', 'strict']}
                    value={profile.ai_prefs.feedback_style}
                    onChange={(feedback_style) =>
                      patchNested('ai_prefs', { feedback_style })
                    }
                    labelFn={(k) => label('feedback', k)}
                  />
                </div>
                <div className="field">
                  <label>{o.focusPref}</label>
                  <ChipGroup
                    options={['speaking', 'reading', 'balanced']}
                    value={profile.ai_prefs.focus}
                    onChange={(focus) => patchNested('ai_prefs', { focus })}
                    labelFn={(k) => label('focus', k)}
                    columns={3}
                  />
                </div>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.ai_prefs.reminders}
                    onChange={(e) =>
                      patchNested('ai_prefs', { reminders: e.target.checked })
                    }
                  />
                  <span>{o.reminders}</span>
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.ai_prefs.cultural_notes}
                    onChange={(e) =>
                      patchNested('ai_prefs', { cultural_notes: e.target.checked })
                    }
                  />
                  <span>{o.culturalNotes}</span>
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.ai_prefs.gamification}
                    onChange={(e) =>
                      patchNested('ai_prefs', { gamification: e.target.checked })
                    }
                  />
                  <span>{o.gamification}</span>
                </label>
              </fieldset>
              <fieldset className="profile-fieldset">
                <legend>{o.accessTitle}</legend>
                <ChipGroup
                  options={['phone', 'tablet', 'desktop']}
                  value={profile.accessibility.device}
                  onChange={(device) => patchNested('accessibility', { device })}
                  labelFn={(k) => label('device', k)}
                  columns={3}
                />
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.accessibility.slow_internet}
                    onChange={(e) =>
                      patchNested('accessibility', { slow_internet: e.target.checked })
                    }
                  />
                  <span>{o.slowInternet}</span>
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.accessibility.audio_first}
                    onChange={(e) =>
                      patchNested('accessibility', { audio_first: e.target.checked })
                    }
                  />
                  <span>{o.audioFirst}</span>
                </label>
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={!!profile.accessibility.high_contrast}
                    onChange={(e) =>
                      patchNested('accessibility', { high_contrast: e.target.checked })
                    }
                  />
                  <span>{o.highContrast}</span>
                </label>
              </fieldset>
              {editing && (
                <label className="field-check">
                  <input
                    type="checkbox"
                    checked={regeneratePlan}
                    onChange={(e) => setRegeneratePlan(e.target.checked)}
                  />
                  <span>{o.regenPlan}</span>
                </label>
              )}
            </div>
          )}

          {step === 'placement' && (
            <div className="profile-step">
              <p className="muted">{o.placementHint}</p>
              <div className="field">
                <label>{o.placeLetter}</label>
                <ChipGroup
                  options={['ཀ', 'क', 'A', 'あ']}
                  value={placementAnswers.letter}
                  onChange={(letter) =>
                    setPlacementAnswers((a) => ({ ...a, letter }))
                  }
                  labelFn={(k) => k}
                  columns={4}
                />
              </div>
              <div className="field">
                <label>{o.placeVocab}</label>
                <ChipGroup
                  options={['water', 'house', 'sun', 'skip']}
                  value={placementAnswers.vocab}
                  onChange={(vocab) => setPlacementAnswers((a) => ({ ...a, vocab }))}
                  labelFn={(k) => label('placeVocab', k)}
                />
              </div>
              <div className="field">
                <label>{o.placeParticle}</label>
                <ChipGroup
                  options={['ལ', 'གིས', 'ནས', 'skip']}
                  value={placementAnswers.particle}
                  onChange={(particle) =>
                    setPlacementAnswers((a) => ({ ...a, particle }))
                  }
                  labelFn={(k) => (k === 'skip' ? o.skip : k)}
                  columns={4}
                />
              </div>
              <div className="field">
                <label>{o.placeRead}</label>
                <ChipGroup
                  options={['none', 'letters', 'simple', 'books']}
                  value={placementAnswers.read}
                  onChange={(read) => setPlacementAnswers((a) => ({ ...a, read }))}
                  labelFn={(k) => label('placeRead', k)}
                />
              </div>
              <div className="field">
                <label>{o.placeWrite}</label>
                <ChipGroup
                  options={['none', 'letters', 'sentences', 'essays']}
                  value={placementAnswers.write}
                  onChange={(write) => setPlacementAnswers((a) => ({ ...a, write }))}
                  labelFn={(k) => label('placeWrite', k)}
                />
              </div>
            </div>
          )}

          {status && <p className="success">{status}</p>}
          {error && <p className="error">{error}</p>}

          <div className="profile-nav">
            {stepIdx > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={back} disabled={busy}>
                {o.backStep}
              </button>
            ) : (
              <span className="profile-nav-spacer" />
            )}
            <button
              type="button"
              className="btn btn-primary profile-nav-primary"
              disabled={busy}
              onClick={next}
            >
              {busy
                ? status || t.loading
                : stepIdx >= STEPS.length - 1
                  ? editing
                    ? regeneratePlan
                      ? o.saveAndRegen
                      : o.saveOnly
                    : o.save
                  : o.next}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

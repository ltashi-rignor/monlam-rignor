import { TIBETAN_VOICES } from '../hooks/useTibetanVoice'
import { useI18n } from '../i18n/useI18n'

export default function VoicePicker({ value, onChange }) {
  const { t } = useI18n()

  return (
    <label className="voice-picker">
      <span className="voice-picker-label">{t.modules.voice}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {TIBETAN_VOICES.map((v) => (
          <option key={v.key} value={v.key}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  )
}

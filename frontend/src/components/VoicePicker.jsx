import { TIBETAN_VOICES } from '../hooks/useTibetanVoice'
import { bo } from '../i18n/bo'

export default function VoicePicker({ value, onChange }) {
  return (
    <label className="voice-picker">
      <span className="voice-picker-label">{bo.modules.voice}</span>
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

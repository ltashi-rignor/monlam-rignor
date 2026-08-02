/** Thin determinate bar for TTS / listen progress (0–1). */
export default function VoicePlaybackBar({
  value = 0,
  active = false,
  label = '',
  indeterminate = false,
  className = '',
}) {
  if (!active && !indeterminate) return null
  const pct = Math.max(0, Math.min(100, Number(value) * 100 || 0))
  return (
    <div
      className={`voice-playback ${className}${indeterminate ? ' is-indeterminate' : ''}${active ? ' is-active' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-label={label || undefined}
      aria-busy={indeterminate || undefined}
    >
      <div
        className="voice-playback-fill"
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  )
}

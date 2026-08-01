/** Banner when Melong returned offline / fallback content. */
export default function OfflineBanner({ source, offline, message }) {
  const show =
    Boolean(offline) ||
    source === 'fallback' ||
    source === 'bank' ||
    source === 'yaml' ||
    source === 'rag' ||
    source === 'rag-bank'
  if (!show) return null
  return (
    <div className="offline-banner" role="status">
      {message ||
        'Offline / curated mode — Melong was unavailable, so a saved lesson plan is shown.'}
    </div>
  )
}


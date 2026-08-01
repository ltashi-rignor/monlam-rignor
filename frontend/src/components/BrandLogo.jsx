import { useI18n } from '../i18n/useI18n'

/** Red “R” mark + language-aware wordmark, side by side. */
export default function BrandLogo({
  className = '',
  size = 'md',
  showWordmark = true,
}) {
  const { t, isEn } = useI18n()
  const wordmark = isEn ? 'Rignor' : 'རིག་ནོར།'

  return (
    <span
      className={`brand-mark brand-mark-${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={t.brand}
    >
      <img
        src="/logo-icon.svg"
        alt=""
        className="brand-mark-icon"
        width={48}
        height={48}
        decoding="async"
      />
      {showWordmark ? (
        <span className={`brand-mark-text${isEn ? ' is-en' : ' is-bo'}`}>{wordmark}</span>
      ) : null}
    </span>
  )
}

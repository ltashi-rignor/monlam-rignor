/** Safe same-origin path for post-login redirects. */
export function safeNextPath(raw, fallback = '/dashboard') {
  if (!raw || typeof raw !== 'string') return fallback
  const path = raw.trim()
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.startsWith('/login')) return fallback
  return path
}

/**
 * Navigate to a protected app path, or to login with ?next= if signed out.
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {object | null} user
 * @param {string} target
 */
export function requireAuth(navigate, user, target) {
  const dest = safeNextPath(target, '/dashboard')
  if (user) {
    if (!user.profile_complete && dest !== '/onboarding') {
      navigate('/onboarding', { replace: false })
      return
    }
    navigate(dest)
    return
  }
  navigate(`/login?next=${encodeURIComponent(dest)}`)
}

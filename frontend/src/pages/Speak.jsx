import { Navigate } from 'react-router-dom'

/** Speaking is part of Story now — keep old bookmarks working. */
export default function Speak() {
  return <Navigate to="/story" replace />
}

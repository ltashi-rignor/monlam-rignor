import { Component } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Catches render errors for the current route subtree.
 * Resets automatically when the route (resetKey) changes so one page
 * crash cannot trap the whole app.
 */
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI error boundary', error, info)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || 'Unknown error'
      return (
        <div className="panel empty" style={{ margin: 24 }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p className="muted">
            This page hit an error. Try again, or open another page from the sidebar.
          </p>
          <p className="muted" dir="ltr" style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/** Prefer wrapping route outlets so navigation clears sticky failures. */
export default function ErrorBoundary({ children, resetKey }) {
  const location = useLocation()
  const key = resetKey ?? `${location.pathname}${location.search}`
  return <ErrorBoundaryInner resetKey={key}>{children}</ErrorBoundaryInner>
}

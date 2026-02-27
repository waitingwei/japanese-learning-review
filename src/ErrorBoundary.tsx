import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#b91c1c', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#57534e', marginBottom: '1rem' }}>
            The app hit an error. Try refreshing the page. If it keeps happening, open Developer Tools (F12 or right‑click → Inspect → Console) and check for errors.
          </p>
          <pre style={{ background: '#f5f5f4', padding: '1rem', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

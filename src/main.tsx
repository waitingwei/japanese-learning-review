import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import './index.css'

// Only enable Clerk when we have a non-empty key (avoid crash on invalid/truncated key)
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const publishableKey =
  rawKey && rawKey.trim().length > 20 && /^pk_(test|live)_/.test(rawKey.trim()) ? rawKey.trim() : undefined

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:2rem;font-family:system-ui">No root element found. Check index.html.</div>'
} else {
  const app = (
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          {publishableKey ? (
            <ClerkProvider publishableKey={publishableKey}>
              <App />
            </ClerkProvider>
          ) : (
            <App />
          )}
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
  createRoot(rootEl).render(app)
}

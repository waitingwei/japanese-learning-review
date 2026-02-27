import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import './index.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

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

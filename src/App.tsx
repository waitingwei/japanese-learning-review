import { Routes, Route, NavLink } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn, SignUp, RedirectToSignIn } from '@clerk/clerk-react'
import { StorageProvider } from './store/StorageContext'
import Home from './pages/Home'
import List from './pages/List'
import Flashcards from './pages/Flashcards'
import Add from './pages/Add'
import Feed from './pages/Feed'

function ProtectedApp() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <nav className="border-b border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 sm:gap-4">
          <NavLink to="/" className="font-semibold text-stone-800 hover:text-rose-600">
            JFBP Review
          </NavLink>
          <NavLink
            to="/list"
            className={({ isActive }) =>
              `min-h-[44px] min-w-[44px] inline-flex items-center rounded px-3 py-2 text-stone-600 hover:text-stone-900 sm:min-h-0 sm:min-w-0 ${isActive ? 'text-rose-600 font-medium' : ''}`
            }
          >
            Browse all
          </NavLink>
          <NavLink
            to="/flashcards"
            className={({ isActive }) =>
              `min-h-[44px] min-w-[44px] inline-flex items-center rounded px-3 py-2 text-stone-600 hover:text-stone-900 sm:min-h-0 sm:min-w-0 ${isActive ? 'text-rose-600 font-medium' : ''}`
            }
          >
            Flashcards
          </NavLink>
          <NavLink
            to="/add"
            className={({ isActive }) =>
              `min-h-[44px] min-w-[44px] inline-flex items-center rounded px-3 py-2 text-stone-600 hover:text-stone-900 sm:min-h-0 sm:min-w-0 ${isActive ? 'text-rose-600 font-medium' : ''}`
            }
          >
            Add
          </NavLink>
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `min-h-[44px] min-w-[44px] inline-flex items-center rounded px-3 py-2 text-stone-600 hover:text-stone-900 sm:min-h-0 sm:min-w-0 ${isActive ? 'text-rose-600 font-medium' : ''}`
            }
          >
            Feed / Import
          </NavLink>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list" element={<List />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/add" element={<Add />} />
          <Route path="/feed" element={<Feed />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  const hasClerk = typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'string' && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.length > 0

  if (!hasClerk) {
    return <ProtectedApp />
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Routes>
        <Route path="/sign-up/*" element={<SignUp signInUrl="/sign-in" />} />
        <Route path="/sign-in/*" element={<SignIn signUpUrl="/sign-up" />} />
        <Route path="/*" element={
          <>
            <SignedIn>
              <StorageProvider>
                <ProtectedApp />
              </StorageProvider>
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        } />
      </Routes>
    </div>
  )
}

export default App

/**
 * Surfaces data-recovery results to the user (success or failure).
 * Used when VITE_USE_API=true; recovery runs in useItems.
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type RecoveryMessage = { kind: 'success'; count: number } | { kind: 'failed' }

const RecoveryContext = createContext<{
  message: RecoveryMessage | null
  setRecoverySuccess: (count: number) => void
  setRecoveryFailed: () => void
} | null>(null)

const AUTO_DISMISS_MS = 6000

export function RecoveryProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<RecoveryMessage | null>(null)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [message])

  const setRecoverySuccess = useCallback((count: number) => {
    setMessage({ kind: 'success', count })
  }, [])

  const setRecoveryFailed = useCallback(() => {
    setMessage({ kind: 'failed' })
  }, [])

  return (
    <RecoveryContext.Provider value={{ message, setRecoverySuccess, setRecoveryFailed }}>
      {children}
    </RecoveryContext.Provider>
  )
}

export function useRecoveryMessage(): {
  message: RecoveryMessage | null
  setRecoverySuccess: (count: number) => void
  setRecoveryFailed: () => void
} {
  const ctx = useContext(RecoveryContext)
  return {
    message: ctx?.message ?? null,
    setRecoverySuccess: ctx?.setRecoverySuccess ?? (() => {}),
    setRecoveryFailed: ctx?.setRecoveryFailed ?? (() => {}),
  }
}

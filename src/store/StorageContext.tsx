import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createApiClient } from '../api/client'
import { createLocalStorageAdapter } from './localStorageAdapter'
import type { ApiClient } from '../api/client'

const useApi = (): boolean =>
  import.meta.env.VITE_USE_API === 'true' || import.meta.env.VITE_USE_API === true

const StorageContext = createContext<ApiClient | null>(null)

export function StorageProvider({ children }: { children: ReactNode }) {
  const useApiFlag = useApi()
  const { getToken } = useAuth()

  const client = useMemo(() => {
    if (useApiFlag && getToken) {
      return createApiClient(getToken)
    }
    return null
  }, [useApiFlag, getToken])

  if (useApiFlag) {
    if (!client) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-stone-500">
          Loading…
        </div>
      )
    }
    return (
      <StorageContext.Provider value={client}>
        {children}
      </StorageContext.Provider>
    )
  }
  return <>{children}</>
}

export function useStorage(): ApiClient {
  const ctx = useContext(StorageContext)
  const useApiFlag = useApi()
  const localAdapter = useMemo(() => createLocalStorageAdapter(), [])
  if (useApiFlag && ctx) return ctx
  return localAdapter
}

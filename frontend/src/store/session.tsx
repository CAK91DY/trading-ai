import { useState, type ReactNode } from 'react'
import { Context, ToastContext } from './contexts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, ApiError } from '../services/api'
import type { User } from '../types'
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    retry: false,
    staleTime: 60000,
  })
  const logout = async () => {
    await post('/auth/logout', {})
    void client.cancelQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
    client.setQueryData(['session'], null)
  }
  return (
    <Context.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        error: query.error,
        setUser: (u) => {
          void client.cancelQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
          client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
          client.setQueryData(['session'], u)
        },
        logout,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function Notifications({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  return (
    <ToastContext.Provider value={setMessage}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="Fermer la notification" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

import { createContext } from 'react'
import type { User } from '../types'
export type Session = {
  user: User | null
  loading: boolean
  error: Error | null
  setUser: (u: User) => void
  logout: () => Promise<void>
}
export const Context = createContext<Session | null>(null)
export const ToastContext = createContext<(message: string) => void>(() => {})

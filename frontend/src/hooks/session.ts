import { useContext } from 'react'
import { Context, ToastContext } from '../store/contexts'
export function useSession() {
  const value = useContext(Context)
  if (!value) throw new Error('Session provider missing')
  return value
}
export const useNotify = () => useContext(ToastContext)

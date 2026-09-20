// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from './session'
import { useSession } from '../hooks/session'
vi.mock('../services/api', () => ({
  api: vi.fn().mockResolvedValue(null),
  post: vi.fn().mockResolvedValue(undefined),
  ApiError: class extends Error {
    status = 401
  },
}))
function Probe() {
  const { user, loading, setUser, logout } = useSession()
  return (
    <>
      <span>{loading ? 'loading' : (user?.name ?? 'anonymous')}</span>
      <button onClick={() => setUser({ id: '1', name: 'Alice', email: 'alice@example.com' })}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </>
  )
}
describe('session query observers', () => {
  it('updates login and logout immediately without leaking private cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['watchlists'], [{ id: 'private-other-account' }])
    render(
      <QueryClientProvider client={client}>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </QueryClientProvider>,
    )
    await screen.findByText('anonymous')
    fireEvent.click(screen.getByText('login'))
    await screen.findByText('Alice')
    expect(client.getQueryData(['watchlists'])).toBeUndefined()
    fireEvent.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByText('anonymous')).toBeTruthy())
    expect(client.getQueryData(['session'])).toBeNull()
  })
})

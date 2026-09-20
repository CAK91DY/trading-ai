import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, Notifications } from './store/session'
import { useSession } from './hooks/session'
import { Loading, ErrorBox } from './components/Feedback'
import AppLayout from './layouts/AppLayout'
import Auth from './pages/Auth'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Markets = lazy(() => import('./pages/Markets'))
const AssetExplorer = lazy(() => import('./pages/AssetExplorer'))
const Watchlists = lazy(() => import('./pages/Watchlists'))
const Strategies = lazy(() => import('./pages/Strategies'))
const Signals = lazy(() => import('./pages/Signals'))
const Backtesting = lazy(() => import('./pages/Backtesting'))
const Settings = lazy(() => import('./pages/Settings'))
const Future = lazy(() => import('./pages/Future'))
import './App.css'
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})
function Protected() {
  const { user, loading, error } = useSession()
  if (loading) return <Loading label="Ouverture de votre espace…" />
  if (error)
    return (
      <div className="startup-error">
        <ErrorBox error={error} retry={() => window.location.reload()} />
      </div>
    )
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SessionProvider>
          <Notifications>
            <Suspense fallback={<Loading />}>
              <Routes>
                {['login', 'register', 'forgot-password', 'reset-password'].map((path) => (
                  <Route key={path} path={'/' + path} element={<Auth key={path} />} />
                ))}
                <Route element={<Protected />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="markets" element={<Markets />} />
                    <Route path="assets" element={<Navigate to="/assets/AAPL" replace />} />
                    <Route path="assets/:symbol" element={<AssetExplorer />} />
                    <Route path="watchlists" element={<Watchlists />} />
                    <Route path="strategies" element={<Strategies />} />
                    <Route path="signals" element={<Signals />} />
                    <Route path="backtesting" element={<Backtesting />} />
                    <Route path="settings" element={<Settings />} />
                    {['paper-trading', 'portfolio', 'risk', 'ai', 'journal', '*'].map((path) => (
                      <Route key={path} path={path} element={<Future />} />
                    ))}
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </Notifications>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

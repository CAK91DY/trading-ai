import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  CircleHelp,
  Compass,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useSession, useNotify } from '../hooks/session'
import { Button } from '../components/ui/button'
const groups: { label: string; items: [string, string, LucideIcon][] }[] = [
  {
    label: 'EXPLORER',
    items: [
      ['/dashboard', 'Dashboard', LayoutDashboard],
      ['/markets', 'Marchés', ChartNoAxesCombined],
      ['/assets/AAPL', 'Asset Explorer', Compass],
      ['/watchlists', 'Watchlists', Star],
    ],
  },
  {
    label: 'LABORATOIRE',
    items: [
      ['/signals', 'Signaux', Activity],
      ['/strategies', 'Stratégies', SlidersHorizontal],
      ['/backtesting', 'Backtesting', FlaskConical],
    ],
  },
  {
    label: 'SIMULATION',
    items: [
      ['/paper-trading', 'Paper Trading', BarChart3],
      ['/portfolio', 'Portefeuille', Wallet],
      ['/risk', 'Gestion du risque', Shield],
      ['/ai', 'AI Analyst', Sparkles],
      ['/journal', 'Journal', BookOpen],
    ],
  },
]
export default function AppLayout() {
  const { user, logout } = useSession()
  const notify = useNotify()
  const [open, setOpen] = useState(false),
    [alerts, setAlerts] = useState(false)
  const location = useLocation()
  const title =
    groups.flatMap((g) => g.items).find(([path]) => location.pathname === path)?.[1] ??
    (location.pathname.startsWith('/assets/') ? 'Asset Explorer' : 'Paramètres')
  return (
    <div className="shell">
      <aside className={open ? 'sidebar expanded' : 'sidebar'}>
        <Link to="/dashboard" className="brand">
          <span>↗</span>trading<b>ai</b>
          <small>LAB</small>
        </Link>
        <Button
          className="mobile-close"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </Button>
        <div className="workspace">
          <span className="workspace-avatar">TA</span>
          <div>
            Espace personnel<small>Recherche & simulation</small>
          </div>
        </div>
        <nav>
          {groups.map((g) => (
            <div key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(([path, label, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={17} />
                  {label}
                  {[
                    '/signals',
                    '/paper-trading',
                    '/portfolio',
                    '/risk',
                    '/ai',
                    '/journal',
                  ].includes(path) && <span className="later-dot" title="Phase ultérieure" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" className="nav-link">
            <Settings size={17} />
            Paramètres
          </NavLink>
          <div className="mode">
            <i />
            Simulation uniquement
          </div>
        </div>
      </aside>
      {open && (
        <button className="backdrop" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              className="mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </Button>
            <span>Workspace</span>
            <span>/</span>
            <b>{title}</b>
          </div>
          <div className="header-actions">
            <span className="badge">
              <i />
              Phase 3 · en cours
            </span>
            <Button variant="ghost" aria-label="Notifications" onClick={() => setAlerts(!alerts)}>
              <Bell size={18} />
            </Button>
            <Link to="/settings" className="avatar" title={user?.name}>
              {user?.name.slice(0, 2).toUpperCase()}
            </Link>
            <Button
              variant="ghost"
              aria-label="Se déconnecter"
              onClick={() => void logout().catch((e) => notify(e.message))}
            >
              <LogOut size={17} />
            </Button>
          </div>
          {alerts && (
            <div className="notification-panel">
              <h3>Votre espace de recherche</h3>
              <p>
                Les cours sont datés et peuvent être différés. Le paper trading et l’IA ne sont pas
                encore activés.
              </p>
              <Link to="/settings" onClick={() => setAlerts(false)}>
                Voir les connexions →
              </Link>
            </div>
          )}
        </header>
        <main className="content">
          <Outlet />
          <footer>
            <span>
              TRADING AI <span className="muted">/ RESEARCH PLATFORM</span>
            </span>
            <span>
              <CircleHelp size={12} />
              Données historiques · Aucun ordre réel
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}

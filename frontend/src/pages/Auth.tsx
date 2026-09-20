import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { post } from '../services/api'
import { useSession } from '../hooks/session'
import type { User } from '../types'
import { Button } from '../components/ui/button'
import { ErrorBox } from '../components/Feedback'
export default function Auth() {
  const path = useLocation().pathname
  const register = path === '/register',
    forgot = path === '/forgot-password',
    reset = path === '/reset-password'
  const { user, setUser } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [message, setMessage] = useState('')
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
  )
  if (user && !reset && !forgot) return <Navigate to="/dashboard" replace />
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if ((register || reset) && password !== confirm)
        throw Error('Les mots de passe ne correspondent pas.')
      if (forgot) {
        const r = await post<{ message: string }>('/auth/forgot-password', { email })
        setMessage(r.message)
      } else if (reset) {
        const r = await post<{ message: string }>('/auth/reset-password', { token, password })
        setMessage(r.message)
        window.history.replaceState(null, '', '/reset-password')
      } else {
        const u = await post<User>(register ? '/auth/register' : '/auth/login', {
          email,
          password,
          ...(register ? { name } : {}),
        })
        setUser(u)
        navigate('/dashboard', { replace: true })
      }
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Link to="/login" className="brand">
          <span>↗</span>trading<b>ai</b>
        </Link>
        <div>
          <div className="eyebrow">LA DONNÉE AVANT LA DÉCISION</div>
          <h1>
            Construisez votre
            <br />
            conviction.
            <br />
            <em>Testez vos idées.</em>
          </h1>
          <p>
            Un espace de recherche pour explorer les marchés,
            <br />
            comprendre les indicateurs et suivre vos actifs.
          </p>
          <div className="auth-graphic">
            <svg viewBox="0 0 480 130">
              <path
                d="M0 115 L30 100 L65 108 L95 70 L125 85 L160 50 L195 67 L230 22 L265 44 L300 15 L335 30 L365 12 L405 33 L445 4 L480 20"
                fill="none"
                stroke="#68dfb9"
                strokeWidth="2"
              />
            </svg>
            <span>EXPLORER → ANALYSER → COMPRENDRE</span>
          </div>
        </div>
        <small>Recherche et simulation. Aucun ordre réel.</small>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <span className="badge">TRADING AI · V0.2</span>
          <h2>
            {register
              ? 'Créez votre espace'
              : forgot
                ? 'Mot de passe oublié ?'
                : reset
                  ? 'Nouveau mot de passe'
                  : 'Heureux de vous retrouver.'}
          </h2>
          <p>
            {register
              ? 'Vos listes et expériences restent liées à votre compte.'
              : forgot
                ? 'Demandez un lien valable 30 minutes.'
                : reset
                  ? 'Choisissez un mot de passe d’au moins 12 caractères.'
                  : 'Connectez-vous à votre laboratoire de marché.'}
          </p>
          <ErrorBox error={error} />
          {message ? (
            <div className="success" role="status">
              {message}
              <p>
                <Link to="/login">Retour à la connexion →</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              {register && (
                <label>
                  Nom
                  <input
                    autoComplete="name"
                    value={name}
                    maxLength={80}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              {!reset && (
                <label>
                  Adresse e-mail
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {!forgot && (
                <label>
                  Mot de passe
                  <input
                    type="password"
                    autoComplete={register || reset ? 'new-password' : 'current-password'}
                    minLength={register || reset ? 12 : 1}
                    maxLength={128}
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {(register || reset) && (
                <label>
                  Confirmer le mot de passe
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              )}
              {!register && !forgot && !reset && (
                <Link className="forgot" to="/forgot-password">
                  Mot de passe oublié ?
                </Link>
              )}
              <Button variant="default" type="submit" disabled={busy || (reset && !token)}>
                {busy
                  ? 'Veuillez patienter…'
                  : register
                    ? 'Créer mon compte →'
                    : forgot
                      ? 'Recevoir le lien'
                      : reset
                        ? 'Enregistrer le mot de passe'
                        : 'Se connecter →'}
              </Button>
            </form>
          )}
          <div className="auth-switch">
            {register ? (
              <Link to="/login">Déjà un compte ? Se connecter</Link>
            ) : (
              <Link to="/register">Pas encore de compte ? Créer mon espace</Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

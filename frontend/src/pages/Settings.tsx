import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSession, useNotify } from '../hooks/session'
import { api } from '../services/api'
import type { User } from '../types'
import { Button } from '../components/ui/button'
import { PageTitle, ErrorBox, Loading } from '../components/Feedback'
const sections = [
  'Général',
  'Profil',
  'Market Data',
  'IA',
  'Paper Trading',
  'Gestion du risque',
  'Notifications',
  'Sécurité',
  'Connexions API',
]
type Status = {
  database: string
  market_data: { provider: string; status: string; last_fetch: number | null; message: string }
  ai: string
  broker: string
  mail_mode: string
}
export default function Settings() {
  const { user, setUser } = useSession(),
    notify = useNotify()
  const [section, setSection] = useState('Général'),
    [name, setName] = useState(user?.name ?? '')
  const status = useQuery({ queryKey: ['settings'], queryFn: () => api<Status>('/settings') })
  const mutation = useMutation({
    mutationFn: () => api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: (u) => {
      setUser(u)
      notify('Profil enregistré.')
    },
  })
  const check = useMutation({
    mutationFn: () => api<Status>('/settings/test-market', { method: 'POST' }),
    onSuccess: () => {
      void status.refetch()
      notify('Test de la source de marché terminé.')
    },
  })
  return (
    <>
      <PageTitle
        eyebrow="VOTRE ESPACE"
        title="Paramètres"
        description="Profil, état des connexions et périmètre de votre plateforme."
      />
      <div className="settings-layout">
        <nav className="settings-tabs">
          {sections.map((s) => (
            <Button
              key={s}
              className={s === section ? 'selected' : ''}
              onClick={() => setSection(s)}
            >
              {s}
            </Button>
          ))}
        </nav>
        <section className="panel settings-panel">
          <h2>{section}</h2>
          <ErrorBox error={mutation.error || status.error || check.error} />
          {section === 'Profil' ? (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              <label>
                Nom affiché
                <input
                  value={name}
                  maxLength={80}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                E-mail
                <input value={user?.email} disabled />
              </label>
              <Button type="submit" variant="default" disabled={mutation.isPending || !name.trim()}>
                Enregistrer
              </Button>
            </form>
          ) : ['Market Data', 'Connexions API'].includes(section) ? (
            status.isPending ? (
              <Loading />
            ) : (
              <>
                <div className="connection-row">
                  <div>
                    <h3>Yahoo Finance / yfinance</h3>
                    <p>{status.data?.market_data.message}</p>
                  </div>
                  <span className="badge">{status.data?.market_data.status ?? 'Inconnu'}</span>
                </div>
                <Button onClick={() => check.mutate()} disabled={check.isPending}>
                  {check.isPending ? 'Test en cours…' : 'Tester la connexion marché'}
                </Button>
                <p className="source-note">
                  Dernière récupération :{' '}
                  {status.data?.market_data.last_fetch
                    ? new Date(status.data.market_data.last_fetch * 1000).toLocaleString('fr-FR')
                    : 'aucune'}
                  . Données pour la recherche personnelle ; leur redistribution SaaS nécessite un
                  fournisseur et des droits adaptés.
                </p>
                <div className="connection-row">
                  <h3>Base de données</h3>
                  <span className="badge">{status.data?.database}</span>
                </div>
                <div className="connection-row">
                  <h3>Fournisseur IA / Broker</h3>
                  <span className="neutral-chip">Non connectés</span>
                </div>
              </>
            )
          ) : section === 'Sécurité' ? (
            <>
              <p>
                Mot de passe haché Argon2. Sessions expirables dans un cookie HttpOnly, révocables à
                la déconnexion. Les données privées sont filtrées par compte.
              </p>
              <Link className="accent-link" to="/forgot-password">
                Réinitialiser mon mot de passe →
              </Link>
              <p>
                Récupération :{' '}
                {status.data?.mail_mode === 'file'
                  ? 'mode local, e-mails enregistrés dans work/mail sur le serveur. Configurez SMTP avant un usage public.'
                  : 'envoi SMTP configuré.'}
              </p>
            </>
          ) : section === 'Général' ? (
            <>
              <h3>Trading AI · 0.2</h3>
              <p>
                Foundation & Market Data. Interface sombre, stockage persistant et données
                historiques réelles.
              </p>
              <p>
                Base : <b>{status.data?.database ?? 'Vérification…'}</b>
              </p>
              <p>
                Affichage des dates : fuseau de votre navigateur. Chaque actif conserve sa devise de
                cotation.
              </p>
              <span className="badge">Simulation uniquement</span>
            </>
          ) : (
            <>
              <p>
                {section === 'Notifications'
                  ? 'Les confirmations et erreurs de vos actions apparaissent dans l’application. Les alertes automatiques de marché seront ajoutées ultérieurement.'
                  : `${section} sera développé dans une phase ultérieure. Aucune connexion ni règle financière n’est modifiée ici.`}
              </p>
              <span className="neutral-chip">Non activé dans les phases 1 et 2</span>
            </>
          )}
        </section>
      </div>
    </>
  )
}

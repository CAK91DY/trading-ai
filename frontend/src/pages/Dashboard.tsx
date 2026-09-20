import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  ArrowRight,
  Star,
  ShieldCheck,
  FlaskConical,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useSession } from '../hooks/session'
import { useMarkets, useWatchlists, useRuns, useSignals } from '../hooks/data'
import { AssetTable } from '../components/AssetTable'
import { PageTitle, ErrorBox, Loading } from '../components/Feedback'
import { Button } from '../components/ui/button'
import { num } from '../utils/format'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
export default function Dashboard() {
  const { user } = useSession()
  const market = useMarkets('?page_size=4'),
    lists = useWatchlists(),
    runs = useRuns(),
    signals = useSignals()
  const latest = runs.data?.[0]
  return (
    <>
      <PageTitle
        eyebrow="VOTRE COCKPIT DE RECHERCHE"
        title={`Bonjour, ${user?.name.split(' ')[0] ?? ''}.`}
        description="Les marchés en perspective. Vos recherches au même endroit."
        action={
          <Button asChild variant="default">
            <Link to="/markets">
              Explorer les marchés
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        }
      />
      <div className="welcome-strip">
        <span>
          <i className="status-dot" />
          Données de marché réelles · Phases Foundation & Market Data
        </span>
        <span className="muted">Simulation uniquement</span>
      </div>
      <div className="metric-grid four">
        <article className="metric">
          <label>
            <Wallet size={16} />
            Valeur du portefeuille
          </label>
          <strong>—</strong>
          <small>Disponible avec le paper trading · Phase 4</small>
        </article>
        <article className="metric">
          <label>
            <Star size={16} />
            Actifs suivis
          </label>
          <strong>{new Set(lists.data?.flatMap((l) => l.symbols) ?? []).size}</strong>
          <small>{lists.data?.length ?? 0} watchlists personnelles</small>
        </article>
        <article className="metric">
          <label>
            <FlaskConical size={16} />
            Backtests enregistrés
          </label>
          <strong>{runs.data?.length ?? 0}</strong>
          <small>Vos 30 dernières expériences</small>
        </article>
        <article className="metric">
          <label>
            <ShieldCheck size={16} />
            Mode d’exécution
          </label>
          <strong className="positive text-small">Recherche</strong>
          <small>Aucun courtier connecté</small>
        </article>
      </div>
      <ErrorBox error={market.error || runs.error || lists.error || signals.error} />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{latest ? 'Dernière courbe de backtest' : 'Portfolio Performance'}</h2>
              <p className="subtitle">
                {latest ? latest.name : 'Le suivi du portefeuille sera activé en phase 4.'}
              </p>
            </div>
            <span className="neutral-chip">{latest ? 'BACKTEST' : 'À VENIR'}</span>
          </div>
          {latest ? (
            <>
              <div className="chart-summary">
                <strong>{num(latest.final_equity)}</strong>
                <span>{num(latest.return_pct)} % · Devise du CSV</span>
              </div>
              <div className="chart-box" style={{ height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={latest.curve}>
                    <CartesianGrid stroke="#26353e" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={60} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#16252d', border: '1px solid #3a535d' }}
                    />
                    <Line
                      type="linear"
                      dataKey="equity"
                      name="Capital"
                      stroke="#67dfb8"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="portfolio-empty">
              <div className="decorative-grid">
                <Wallet size={32} />
              </div>
              <h3>Les chiffres viendront de vos données.</h3>
              <p>Aucun capital, rendement ou P&L simulé n’est présenté comme réel.</p>
              <Button asChild>
                <Link to="/backtesting">
                  Ouvrir le backtesting
                  <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          )}
        </section>
        <section className="panel research-card">
          <div className="eyebrow">VOTRE PROCHAINE ÉTAPE</div>
          <h2>
            Construisez votre
            <br />
            univers de marché.
          </h2>
          <p>Choisissez un actif, explorez son historique et ajoutez-le à une watchlist.</p>
          <ol>
            <li>
              <span>01</span>Explorer les actions et ETF
            </li>
            <li>
              <span>02</span>Comparer les indicateurs
            </li>
            <li>
              <span>03</span>Organiser vos watchlists
            </li>
          </ol>
          <Button asChild>
            <Link to="/watchlists">
              Mes watchlists
              <ArrowRight size={15} />
            </Link>
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Market Overview</h2>
            <p className="subtitle">Dernières séances disponibles · Yahoo Finance</p>
          </div>
          <Link className="accent-link" to="/markets">
            Tous les actifs →
          </Link>
        </div>
        {market.isPending ? (
          <Loading label="Chargement des cours réels…" />
        ) : (
          market.data && <AssetTable items={market.data.items} />
        )}
      </section>
      <div className="three-grid">
        <section className="panel future-card">
          <h2>Recent Signals</h2>
          {signals.data?.length ? (
            <p>
              {signals.data.length} signal{signals.data.length > 1 ? 'aux' : ''} détecté
              {signals.data.length > 1 ? 's' : ''}. Dernier : {signals.data[0].symbol} —{' '}
              {signals.data[0].side}.
            </p>
          ) : (
            <p>Détectez un signal depuis une stratégie active.</p>
          )}
          <Link to="/signals">Voir le périmètre →</Link>
        </section>
        {[
          ['Recent Trades', 'Les transactions paper seront disponibles en phase 4.', '/journal'],
          ['Risk Alerts', 'Le contrôle des ordres sera activé avec le paper trading.', '/risk'],
        ].map(([title, description, url]) => (
          <section className="panel future-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link to={url}>Voir le périmètre →</Link>
          </section>
        ))}
      </div>
      <section className="panel ai-banner">
        <Sparkles size={30} />
        <div>
          <h2>AI Analyst</h2>
          <p>
            L’analyse automatique sera ajoutée en phase 5, à partir des données validées de la
            plateforme.
          </p>
        </div>
        <span className="neutral-chip">NON CONNECTÉ</span>
      </section>
    </>
  )
}

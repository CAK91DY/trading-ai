import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRuns } from '../hooks/data'
import { api, post } from '../services/api'
import { StrategySummary } from '../components/StrategySummary'
import type { Asset, Run, Strategy } from '../types'
import { PageTitle, ErrorBox, Loading, Empty } from '../components/Feedback'
import { Button } from '../components/ui/button'
import { num } from '../utils/format'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
export default function Backtesting() {
  const [search] = useSearchParams()
  const strategies = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api<Strategy[]>('/strategies'),
  })
  const [strategyId, setStrategyId] = useState(search.get('strategy') || '')
  const strategy = strategies.data?.find((s) => s.id === strategyId)
  const assets = useQuery({ queryKey: ['assets'], queryFn: () => api<Asset[]>('/assets') })
  const [yesterday] = useState(() => new Date(Date.now() - 86400000).toISOString().slice(0, 10))
  const [mode, setMode] = useState<'market' | 'csv'>('market')
  const [symbol, setSymbol] = useState(search.get('symbol') || 'AAPL')
  const [start, setStart] = useState(() =>
    new Date(Date.now() - 2 * 365 * 86400000).toISOString().slice(0, 10),
  )
  const [end, setEnd] = useState(yesterday)
  const runs = useRuns(),
    client = useQueryClient()
  const [selected, setSelected] = useState<Run | null>(null),
    [csv, setCsv] = useState(''),
    [name, setName] = useState('EMA Momentum'),
    [fileError, setFileError] = useState<Error | null>(null)
  const [params, setParams] = useState({
    capital: 10000,
    fast: 20,
    slow: 50,
    fee_bps: 10,
    slippage_bps: 5,
    allocation: 20,
  })
  const mutation = useMutation({
    mutationFn: () =>
      post<Run>(mode === 'market' ? '/backtests/market' : '/backtests', {
        ...(mode === 'market' ? { symbol, start, end, strategy_id: strategyId || null } : { csv }),
        name,
        ...params,
        ...(mode === 'market' && strategy
          ? { fast: strategy.definition.fast, slow: strategy.definition.slow }
          : {}),
        allocation: params.allocation / 100,
      }),
    onSuccess: (r) => {
      setSelected(r)
      void client.invalidateQueries({ queryKey: ['backtests'] })
    },
  })
  const run = selected ?? runs.data?.[0]
  const labels = {
    capital: 'Capital initial (devise de l’actif / du CSV)',
    fast: 'EMA rapide',
    slow: 'EMA lente',
    fee_bps: 'Frais (points de base)',
    slippage_bps: 'Glissement (points de base)',
    allocation: 'Allocation (%)',
  }
  async function file(f?: File) {
    if (!f) return
    setFileError(null)
    if (f.size > 2_000_000) {
      setFileError(Error('Maximum 2 Mo.'))
      setCsv('')
      return
    }
    setCsv(await f.text())
    setName(f.name.replace(/\.csv$/i, ''))
  }
  return (
    <>
      <PageTitle
        eyebrow="LABORATOIRE QUANTITATIF · STRATÉGIE EMA"
        title="Backtesting"
        description="Testez une stratégie sur les historiques réels, avec des résultats privés et sauvegardés."
      />
      <ErrorBox
        error={mutation.error || runs.error || assets.error || strategies.error || fileError}
      />
      <section className="panel">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="panel-heading">
            <h2>Nouvelle expérience</h2>
            <span className="neutral-chip">SIMULATION · QUOTIDIEN</span>
          </div>
          {!(mode === 'market' && strategyId) && (
            <p className="subtitle">
              Achat si EMA rapide &gt; EMA lente à la clôture ; sortie sinon. Exécution à
              l’ouverture suivante, sans levier. La dernière position est liquidée à la clôture
              finale.
            </p>
          )}
          <label>
            Source des données
            <select value={mode} onChange={(e) => setMode(e.target.value as 'market' | 'csv')}>
              <option value="market">Historique de marché réel</option>
              <option value="csv">Importer un CSV</option>
            </select>
          </label>
          {mode === 'market' ? (
            <div className="form-grid">
              <label>
                Actif
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} required>
                  {assets.data?.map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol} — {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Début
                <input
                  type="date"
                  required
                  value={start}
                  max={end}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Fin
                <input
                  type="date"
                  required
                  value={end}
                  min={start}
                  max={yesterday}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label className="upload">
              Importer un historique · colonnes date,open,close
              <input
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(e) => void file(e.target.files?.[0])}
              />
            </label>
          )}
          {mode === 'market' && (
            <>
              <label>
                Stratégie
                <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
                  <option value="">EMA simple (paramètres ci-dessous)</option>
                  {strategies.data?.map((s) => (
                    <option key={s.id} value={s.id} disabled={!s.active}>
                      {s.name}
                      {!s.active ? ' — inactive' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {strategy && <StrategySummary definition={strategy.definition} />}
              {!!strategyId && !strategy?.active && !strategies.isPending && (
                <p className="error">
                  Stratégie indisponible ou inactive. Choisissez une stratégie active.
                </p>
              )}
            </>
          )}
          <div className="form-grid">
            <label>
              Nom
              <input
                value={name}
                required
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {Object.entries(params)
              .filter(
                ([key]) => !(mode === 'market' && strategyId && ['fast', 'slow'].includes(key)),
              )
              .map(([key, value]) => (
                <label key={key}>
                  {labels[key as keyof typeof labels]}
                  <input
                    type="number"
                    step="any"
                    required
                    value={value}
                    onChange={(e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
                  />
                </label>
              ))}
          </div>
          <Button
            variant="default"
            type="submit"
            disabled={
              (mode === 'csv'
                ? !csv
                : !assets.data?.length || (!!strategyId && !strategy?.active)) || mutation.isPending
            }
          >
            {mutation.isPending ? 'Calcul en cours…' : 'Lancer le backtest →'}
          </Button>
        </form>
      </section>
      {runs.isPending ? (
        <Loading />
      ) : run ? (
        <>
          <section className="panel">
            <h2>
              {run.name}
              {run.symbol ? ` · ${run.symbol} · ${run.currency}` : ' · CSV'}
            </h2>
            <p>
              {run.start} → {run.end} · {run.bars} séances simulées
            </p>
            {run.parameters && (
              <p className="subtitle">
                EMA {run.parameters.fast} / {run.parameters.slow} · Capital{' '}
                {num(run.parameters.capital)} {run.currency ?? ''} · Allocation{' '}
                {num(run.parameters.allocation * 100)} % · Frais {run.parameters.fee_bps} pb ·
                Glissement {run.parameters.slippage_bps} pb
              </p>
            )}
            {run.strategy_snapshot && (
              <>
                <h3>Stratégie enregistrée : {run.strategy_snapshot.name}</h3>
                <StrategySummary definition={run.strategy_snapshot.definition} />
              </>
            )}
            {run.market_meta && (
              <p className="subtitle">
                {run.market_meta.source} · {run.market_meta.adjustment} · {run.warmup_bars} séances
                d’initialisation antérieures au test. Données figées avec le résultat ; aucun cours
                temps réel requis.
              </p>
            )}
            {run.market_meta?.warning && <p className="error">{run.market_meta.warning}</p>}
          </section>
          <section className="metric-grid four">
            {[
              ['Capital final', num(run.final_equity)],
              ['Rendement', num(run.return_pct) + ' %'],
              ['Drawdown', num(run.max_drawdown_pct) + ' %'],
              ['Frais', num(run.fees)],
              ['Transactions clôturées', String(run.completed_trades)],
              ['Taux de réussite', num(run.win_rate_pct) + (run.win_rate_pct == null ? '' : ' %')],
              ['Sharpe (taux sans risque nul)', num(run.sharpe_ratio ?? null)],
              ['Profit factor', num(run.profit_factor ?? null)],
            ].map(([label, value]) => (
              <article className="metric" key={label}>
                <label>{label}</label>
                <strong>{value}</strong>
                <small>Résultat calculé · {run.name}</small>
              </article>
            ))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Courbe de capital</h2>
              <span>
                {run.start} → {run.end}
              </span>
            </div>
            <div className="chart-box" style={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={run.curve}>
                  <CartesianGrid stroke="#26353e" vertical={false} />
                  <XAxis dataKey="date" minTickGap={60} tick={{ fontSize: 10 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#16252d' }} />
                  <Line dataKey="equity" name="Capital" stroke="#67dfb8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <h2>Exécutions simulées</h2>
            <p className="subtitle">
              Un achat et sa vente constituent une transaction clôturée. Les frais sont inclus dans
              les résultats. « — » indique une métrique non définie.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {['Date', 'Opération', 'Prix', 'Quantité', 'Frais'].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.trades.map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.side}</td>
                      <td>{num(t.price)}</td>
                      <td>{num(t.quantity)}</td>
                      <td>{num(t.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!run.trades.length && <p>Aucun signal sur cette période.</p>}
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty title="Aucune expérience enregistrée">
            <p>Choisissez un actif et une période pour lancer votre premier backtest.</p>
          </Empty>
        </section>
      )}
      {!!runs.data?.length && (
        <section className="panel">
          <h2>Expériences récentes</h2>
          {runs.data.map((r) => (
            <Button key={r.id} className="history-row" onClick={() => setSelected(r)}>
              <span>
                {r.name} · {r.start}
              </span>
              <b>{num(r.return_pct)} %</b>
            </Button>
          ))}
        </section>
      )}
    </>
  )
}

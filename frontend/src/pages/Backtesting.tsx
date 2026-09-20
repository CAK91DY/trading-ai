import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRuns } from '../hooks/data'
import { post } from '../services/api'
import type { Run } from '../types'
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
  const runs = useRuns(),
    client = useQueryClient()
  const [selected, setSelected] = useState<Run | null>(null),
    [csv, setCsv] = useState(''),
    [name, setName] = useState(''),
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
      post<Run>('/backtests', { csv, name, ...params, allocation: params.allocation / 100 }),
    onSuccess: (r) => {
      setSelected(r)
      void client.invalidateQueries({ queryKey: ['backtests'] })
    },
  })
  const run = selected ?? runs.data?.[0]
  const labels = {
    capital: 'Capital initial',
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
        eyebrow="LABORATOIRE EXISTANT · PHASE 3 À ÉTENDRE"
        title="Backtesting"
        description="Le moteur EMA de la première version reste disponible, avec des résultats privés par compte."
      />
      <ErrorBox error={mutation.error || runs.error || fileError} />
      <section className="panel">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="panel-heading">
            <h2>Nouvelle expérience</h2>
            <span className="neutral-chip">CSV QUOTIDIEN</span>
          </div>
          <p className="subtitle">
            Colonnes : date,open,close · Dates ISO croissantes · Prix ajustés dans une même devise.
          </p>
          <label className="upload">
            Importer un historique
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => void file(e.target.files?.[0])}
            />
          </label>
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
            {Object.entries(params).map(([key, value]) => (
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
          <Button variant="default" type="submit" disabled={!csv || mutation.isPending}>
            {mutation.isPending ? 'Calcul en cours…' : 'Lancer le backtest →'}
          </Button>
        </form>
      </section>
      {runs.isPending ? (
        <Loading />
      ) : run ? (
        <>
          <section className="metric-grid four">
            {[
              ['Capital final', num(run.final_equity)],
              ['Rendement', num(run.return_pct) + ' %'],
              ['Drawdown', num(run.max_drawdown_pct) + ' %'],
              ['Frais', num(run.fees)],
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
            <h2>Transactions</h2>
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
            <p>Importez votre historique pour lancer un premier backtest.</p>
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

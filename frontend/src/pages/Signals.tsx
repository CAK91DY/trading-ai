import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, post } from '../services/api'
import { useSignals } from '../hooks/data'
import type { Asset, Signal, Strategy, RuleReading } from '../types'
import { PageTitle, ErrorBox, Loading, Empty } from '../components/Feedback'
import { Button } from '../components/ui/button'
import { indicatorLabels } from '../components/StrategySummary'
import { num, date } from '../utils/format'

const sideLabels = { BUY: 'ACHAT', SELL: 'VENTE', WAIT: 'ATTENTE' }
const sideClass = { BUY: 'positive', SELL: 'negative', WAIT: 'muted' }

function RuleList({ rules, mode }: { rules: RuleReading[]; mode: 'all' | 'any' }) {
  return (
    <ul className="rule-list">
      {rules.map((r, i) => (
        <li key={i} className={r.passed ? 'positive' : 'muted'}>
          {r.passed ? '✓' : '✗'} {indicatorLabels[r.indicator]} {r.operator}{' '}
          {typeof r.value === 'number' ? r.value : indicatorLabels[r.value]}
          {r.actual != null && <span className="muted"> (valeur : {num(r.actual)})</span>}
        </li>
      ))}
      <li className="subtitle">Combinaison : {mode === 'all' ? 'ET (toutes)' : 'OU (au moins une)'}</li>
    </ul>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <h3>
            {signal.symbol} · {signal.strategy_snapshot.name}
          </h3>
          <p className="subtitle">
            {date(signal.date)} · Clôture {num(signal.price)} · Détecté le{' '}
            {new Date(signal.created_at * 1000).toLocaleString('fr-FR')}
          </p>
        </div>
        <span className={sideClass[signal.side]}>
          <b>{sideLabels[signal.side]}</b>
        </span>
      </div>
      <p className="subtitle">
        EMA rapide {num(signal.indicators.ema_fast)} · EMA lente {num(signal.indicators.ema_slow)}
        {signal.indicators.rsi != null && <> · RSI14 {num(signal.indicators.rsi)}</>}
      </p>
      <div className="form-grid">
        <div>
          <h4>Conditions d’entrée</h4>
          <RuleList rules={signal.conditions.entry} mode={signal.conditions.entry_mode} />
        </div>
        <div>
          <h4>Conditions de sortie</h4>
          <RuleList rules={signal.conditions.exit} mode={signal.conditions.exit_mode} />
        </div>
      </div>
      <p className="subtitle">
        Statut : <b>{signal.status}</b> — un signal n’est jamais un ordre. Le contrôle de risque
        (Risk Engine) et le paper trading arrivent en phase 4.
      </p>
    </article>
  )
}

export default function Signals() {
  const strategies = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api<Strategy[]>('/strategies'),
  })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Asset[]>('/assets') })
  const signals = useSignals()
  const client = useQueryClient()
  const active = strategies.data?.filter((s) => s.active) ?? []
  const [strategyId, setStrategyId] = useState('')
  const [symbol, setSymbol] = useState('')
  const scan = useMutation({
    mutationFn: () => post<Signal>('/signals/scan', { strategy_id: strategyId, symbol }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['signals'] })
    },
  })
  return (
    <>
      <PageTitle
        eyebrow="MOTEUR DE SIGNAUX"
        title="Signals"
        description="Évaluez vos stratégies actives sur la dernière séance disponible. Un signal détecté n’est ni une recommandation ni un ordre."
      />
      <ErrorBox error={strategies.error || catalog.error || signals.error || scan.error} />
      <section className="panel">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            scan.mutate()
          }}
        >
          <select
            aria-label="Stratégie"
            required
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
          >
            <option value="">Choisir une stratégie active…</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Actif"
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            <option value="">Choisir un actif…</option>
            {catalog.data?.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} — {a.name}
              </option>
            ))}
          </select>
          <Button variant="default" type="submit" disabled={scan.isPending || !strategyId || !symbol}>
            {scan.isPending ? 'Détection…' : 'Détecter un signal →'}
          </Button>
        </form>
        {!strategies.isPending && !active.length && (
          <p className="subtitle">
            Aucune stratégie active. <Link to="/strategies">Créez ou activez-en une</Link> avant de
            détecter un signal.
          </p>
        )}
      </section>
      {scan.data && <SignalCard signal={scan.data} />}
      <section className="panel">
        <div className="panel-heading">
          <h2>Historique des signaux</h2>
        </div>
        {signals.isPending ? (
          <Loading />
        ) : !signals.data?.length ? (
          <Empty title="Aucun signal détecté pour l’instant">
            <p>Lancez une détection ci-dessus pour commencer.</p>
          </Empty>
        ) : (
          <div className="signal-list">
            {signals.data.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

import type { Definition, Rule } from '../types'
export const indicatorLabels = { ema_fast: 'EMA rapide', ema_slow: 'EMA lente', rsi: 'RSI 14' }
export function ruleText(r: Rule) {
  return `${indicatorLabels[r.indicator]} ${r.operator} ${typeof r.value === 'number' ? r.value : indicatorLabels[r.value]}`
}
export function StrategySummary({ definition: d }: { definition: Definition }) {
  return (
    <div className="subtitle">
      <p>
        EMA {d.fast} / {d.slow} · RSI 14 (Wilder)
      </p>
      <p>
        <b>Entrée :</b> {d.entry.map(ruleText).join(d.entry_mode === 'all' ? ' ET ' : ' OU ')}
      </p>
      <p>
        <b>Sortie :</b> {d.exit.map(ruleText).join(d.exit_mode === 'all' ? ' ET ' : ' OU ')}
      </p>
    </div>
  )
}

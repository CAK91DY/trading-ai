import { Link } from 'react-router-dom'
import { Star, ArrowUpRight } from 'lucide-react'
import type { Asset } from '../types'
import { num, money, date, changeClass } from '../utils/format'
import { Button } from './ui/button'
export function AssetTable({
  items,
  onStar,
  starred = [],
}: {
  items: Asset[]
  onStar?: (a: Asset) => void
  starred?: string[]
}) {
  return (
    <div className="table-scroll">
      <table className="asset-table">
        <thead>
          <tr>
            <th>ACTIF</th>
            <th>DERNIER COURS</th>
            <th>VARIATION</th>
            <th>VOLUME</th>
            <th>VOLATILITÉ ANNUALISÉE</th>
            <th>SIGNAL</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.symbol}>
              <td>
                <Link className="asset-name" to={'/assets/' + a.symbol}>
                  <span className="ticker-icon">{a.symbol.slice(0, 2)}</span>
                  <span>
                    <b>{a.symbol}</b>
                    <small>{a.name}</small>
                  </span>
                </Link>
              </td>
              <td>
                <b>{money(a.price, a.currency)}</b>
                <small>
                  {a.error ? 'Indisponible' : date(a.as_of)}
                  {a.meta?.stale ? ' · Cache ancien' : ''}
                </small>
              </td>
              <td className={changeClass(a.change_pct)}>
                {a.change_pct != null && a.change_pct >= 0 ? '+' : ''}
                {num(a.change_pct)}
                {a.change_pct != null ? ' %' : ''}
                <small>{money(a.change, a.currency)}</small>
              </td>
              <td>
                {a.volume == null
                  ? '—'
                  : Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(a.volume)}
              </td>
              <td>
                {num(a.volatility)}
                {a.volatility != null ? ' %' : ''}
              </td>
              <td>
                <span className="neutral-chip">Phase 3</span>
              </td>
              <td>
                {onStar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={
                      (starred.includes(a.symbol) ? 'Retirer ' : 'Ajouter ') +
                      a.symbol +
                      ' à la watchlist'
                    }
                    onClick={() => onStar(a)}
                  >
                    <Star size={17} fill={starred.includes(a.symbol) ? 'currentColor' : 'none'} />
                  </Button>
                )}
                <Link aria-label={'Explorer ' + a.symbol} to={'/assets/' + a.symbol}>
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

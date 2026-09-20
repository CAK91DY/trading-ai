import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Star, ArrowLeft } from 'lucide-react'
import { useAsset, useHistory } from '../hooks/data'
import { PriceChart } from '../components/PriceChart'
import { PageTitle, ErrorBox, Loading } from '../components/Feedback'
import { WatchlistPicker } from '../components/WatchlistPicker'
import { Button } from '../components/ui/button'
import { money, num, date, changeClass } from '../utils/format'
const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y']
const indicators = ['SMA', 'EMA', 'RSI', 'MACD', 'ATR', 'Bollinger', 'Volume']
export default function AssetExplorer() {
  const { symbol = 'AAPL' } = useParams()
  const [period, setPeriod] = useState('1Y'),
    [enabled, setEnabled] = useState(['EMA', 'Volume']),
    [picker, setPicker] = useState(false)
  const asset = useAsset(symbol),
    history = useHistory(symbol, period)
  const a = asset.data,
    points = history.data?.points ?? [],
    latest = points.at(-1)
  const lines = [
    'close',
    ...(enabled.includes('SMA') ? ['sma20'] : []),
    ...(enabled.includes('EMA') ? ['ema20', 'ema50'] : []),
    ...(enabled.includes('Bollinger') ? ['bb_upper', 'bb_lower'] : []),
  ]
  return (
    <>
      <Link className="back-link" to="/markets">
        <ArrowLeft size={14} />
        Marchés
      </Link>
      <PageTitle
        eyebrow={(a?.exchange ?? 'ASSET EXPLORER') + ' · ' + (a?.currency ?? '')}
        title={a ? `${a.name} / ${a.symbol}` : symbol}
        description={`${a?.kind === 'etf' ? 'ETF' : 'Action'} · ${a?.sector ?? 'Chargement'} · Historique ajusté`}
        action={
          <Button onClick={() => setPicker(true)}>
            <Star size={16} />
            Suivre cet actif
          </Button>
        }
      />
      <ErrorBox error={asset.error} />
      {asset.isPending ? (
        <Loading />
      ) : (
        a && (
          <div className="asset-hero">
            <strong>{money(a.price, a.currency)}</strong>
            <span className={changeClass(a.change_pct)}>
              {a.change_pct != null && a.change_pct >= 0 ? '+' : ''}
              {num(a.change_pct)} % <small>dernière séance</small>
            </span>
            <span className="muted">Cours du {date(a.as_of)}</span>
          </div>
        )
      )}
      {a?.error && <div className="error">{a.error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Historique du cours</h2>
          <div className="periods">
            {periods.map((p) => (
              <Button
                size="sm"
                key={p}
                className={p === period ? 'selected' : ''}
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
        <div className="indicator-toggles">
          {indicators.map((i) => (
            <label key={i}>
              <input
                type="checkbox"
                checked={enabled.includes(i)}
                onChange={() =>
                  setEnabled((prev) =>
                    prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                  )
                }
              />
              {i}
            </label>
          ))}
        </div>
        <ErrorBox error={history.error} retry={() => void history.refetch()} />
        {history.isPending ? (
          <Loading label="Chargement de l’historique et calcul des indicateurs…" />
        ) : (
          <>
            <PriceChart points={points} keys={lines} brush intraday={period === '1D'} />
            {enabled.includes('Volume') && (
              <>
                <h3 className="chart-label">VOLUME</h3>
                <PriceChart
                  points={points}
                  keys={['volume']}
                  height={140}
                  intraday={period === '1D'}
                />
              </>
            )}
            {enabled.includes('RSI') && (
              <>
                <h3 className="chart-label">RSI 14 · WILDER</h3>
                <PriceChart
                  points={points}
                  keys={['rsi']}
                  height={170}
                  intraday={period === '1D'}
                />
              </>
            )}
            {enabled.includes('MACD') && (
              <>
                <h3 className="chart-label">MACD 12 / 26 / 9</h3>
                <PriceChart
                  points={points}
                  keys={['macd', 'macd_signal']}
                  height={170}
                  intraday={period === '1D'}
                />
              </>
            )}
            {enabled.includes('ATR') && (
              <>
                <h3 className="chart-label">ATR 14 · WILDER</h3>
                <PriceChart
                  points={points}
                  keys={['atr']}
                  height={150}
                  intraday={period === '1D'}
                />
              </>
            )}
          </>
        )}
        {history.data && (
          <p className="source-note">
            {history.data.meta.source} · {history.data.meta.adjustment} · {points.length} bougies ·{' '}
            {period === '1D' ? '5 minutes, dernière séance disponible' : 'Quotidien'} ·{' '}
            {history.data.meta.warning ?? 'Cours différés / historiques'}
            <br />
            Les périodes sont ancrées à la dernière séance reçue. Les indicateurs 1D utilisent des
            bougies de 5 minutes.
          </p>
        )}
      </section>
      <div className="metric-grid">
        {[
          ['SMA 20', latest?.sma20],
          ['EMA 20', latest?.ema20],
          ['EMA 50', latest?.ema50],
          ['RSI 14', latest?.rsi],
          ['MACD', latest?.macd],
          ['ATR 14', latest?.atr],
        ].map(([label, value]) => (
          <article className="metric" key={String(label)}>
            <label>{String(label)}</label>
            <strong>{num(value as number | undefined)}</strong>
            <small>Calculé sur {period === '1D' ? '5 minutes' : 'séances quotidiennes'}</small>
          </article>
        ))}
      </div>
      {picker && <WatchlistPicker symbol={symbol} onClose={() => setPicker(false)} />}
    </>
  )
}

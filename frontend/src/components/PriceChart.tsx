import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  Legend,
} from 'recharts'
import type { Point } from '../types'
import { num } from '../utils/format'
const colors: Record<string, string> = {
  close: '#64dfba',
  sma20: '#e2c174',
  ema20: '#a2afff',
  ema50: '#f59db6',
  bb_upper: '#607888',
  bb_lower: '#607888',
  rsi: '#a9a3ff',
  macd: '#64dfba',
  macd_signal: '#e2c174',
  atr: '#f59db6',
  volume: '#2a7563',
}
const labels: Record<string, string> = {
  close: 'Clôture',
  sma20: 'SMA 20',
  ema20: 'EMA 20',
  ema50: 'EMA 50',
  bb_upper: 'Bollinger haute',
  bb_lower: 'Bollinger basse',
  rsi: 'RSI 14',
  macd: 'MACD',
  macd_signal: 'Signal MACD',
  atr: 'ATR 14',
  volume: 'Volume',
}
export function PriceChart({
  points,
  keys,
  height = 320,
  brush = false,
  intraday = false,
}: {
  points: Point[]
  keys: string[]
  height?: number
  brush?: boolean
  intraday?: boolean
}) {
  return (
    <div
      className="chart-box"
      style={{ height }}
      role="img"
      aria-label={'Graphique interactif ' + keys.map((k) => labels[k]).join(', ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 12, right: 12, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="#24343e" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="timestamp"
            minTickGap={60}
            stroke="#78909e"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) =>
              new Date(v).toLocaleString(
                'fr-FR',
                intraday
                  ? { hour: '2-digit', minute: '2-digit' }
                  : { month: 'short', day: 'numeric' },
              )
            }
          />
          <YAxis
            domain={['auto', 'auto']}
            stroke="#78909e"
            tick={{ fontSize: 10 }}
            width={65}
            tickFormatter={(v) => num(Number(v), 1)}
          />
          <Tooltip
            contentStyle={{
              background: '#17242c',
              border: '1px solid #334852',
              borderRadius: 8,
              color: '#eaf3f4',
            }}
            labelFormatter={(v) => new Date(String(v)).toLocaleString('fr-FR')}
            formatter={(v, name) => [num(Number(v)), labels[String(name)] ?? name]}
          />
          <Legend formatter={(value) => labels[String(value)] ?? value} />
          {keys.map((k) =>
            k === 'volume' ? (
              <Bar key={k} dataKey={k} fill={colors[k]} isAnimationActive={false} />
            ) : (
              <Line
                key={k}
                dataKey={k}
                stroke={colors[k]}
                strokeWidth={k === 'close' ? 2 : 1.4}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ),
          )}
          {brush && (
            <Brush
              dataKey="timestamp"
              height={22}
              stroke="#405f64"
              fill="#142027"
              tickFormatter={(v) => new Date(v).toLocaleDateString('fr-FR')}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

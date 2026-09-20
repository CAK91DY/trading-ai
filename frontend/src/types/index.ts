export type User = { id: string; name: string; email: string }
export type Watchlist = { id: string; name: string; symbols: string[] }
export type Meta = {
  source: string
  fetched_at: number
  stale: boolean
  warning: string | null
  interval: string
  as_of?: string
  adjustment: string
  realtime: boolean
}
export type Asset = {
  symbol: string
  name: string
  kind: 'stock' | 'etf'
  currency: string
  exchange: string
  sector: string
  price: number | null
  change: number | null
  change_pct: number | null
  volume: number | null
  volatility: number | null
  as_of: string | null
  signal: null
  meta: Meta | null
  sparkline: number[]
  error: string | null
}
export type MarketPage = {
  items: Asset[]
  page: number
  page_size: number
  total: number
  universe: string
}
export type Point = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma20: number | null
  ema20: number | null
  ema50: number | null
  rsi: number | null
  macd: number | null
  macd_signal: number | null
  macd_histogram: number | null
  atr: number | null
  bb_upper: number | null
  bb_lower: number | null
}
export type History = {
  symbol: string
  currency: string
  period: string
  meta: Meta
  points: Point[]
}
export type Run = {
  strategy_snapshot?: Strategy | null
  symbol?: string
  currency?: string
  warmup_bars?: number
  market_meta?: Meta
  sharpe_ratio?: number | null
  profit_factor?: number | null
  annualized_return_pct?: number | null
  parameters?: {
    capital: number
    fast: number
    slow: number
    fee_bps: number
    slippage_bps: number
    allocation: number
  }

  id: string
  name: string
  start: string
  end: string
  bars: number
  final_equity: number
  return_pct: number
  max_drawdown_pct: number
  fees: number
  completed_trades: number
  win_rate_pct: number | null
  curve: { date: string; equity: number }[]
  trades: { date: string; side: string; price: number; quantity: number; fee: number }[]
}

export type Rule = {
  indicator: 'ema_fast' | 'ema_slow' | 'rsi'
  operator: '>' | '>=' | '<' | '<='
  value: 'ema_fast' | 'ema_slow' | number
}
export type Definition = {
  fast: number
  slow: number
  entry_mode: 'all' | 'any'
  exit_mode: 'all' | 'any'
  entry: Rule[]
  exit: Rule[]
}
export type Strategy = { id: string; name: string; active: boolean; definition: Definition }

export type RuleReading = Rule & { actual: number | null; passed: boolean }
export type Signal = {
  id: string
  strategy_id: string | null
  symbol: string
  date: string
  price: number
  side: 'BUY' | 'SELL' | 'WAIT'
  status: 'DETECTED' | 'RISK_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  strategy_snapshot: Strategy
  indicators: { ema_fast: number; ema_slow: number; rsi: number | null }
  conditions: {
    entry_mode: 'all' | 'any'
    exit_mode: 'all' | 'any'
    entry: RuleReading[]
    exit: RuleReading[]
  }
  created_at: number
}

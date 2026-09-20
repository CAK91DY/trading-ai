from app.strategies.ema import ema
from app.risk.sizing import position_size


def run_backtest(rows, capital=10000., fast=20, slow=50, fee_bps=10., slippage_bps=5., allocation=.2):
    if not 2 <= fast < slow < len(rows):
        raise ValueError("Périodes : 2 ≤ EMA rapide < EMA lente < nombre de séances.")
    fee, slip = fee_bps / 10000, slippage_bps / 10000
    closes = [r["close"] for r in rows]
    short, long = ema(closes, fast), ema(closes, slow)
    cash, units, entry_cost, fees = capital, 0., 0., 0.
    trades, curve, outcomes = [], [], []
    peak, drawdown = capital, 0.
    for i, row in enumerate(rows):
        # Only yesterday's completed candle may determine today's opening order.
        signal = i >= slow and short[i-1] > long[i-1]
        if signal and units == 0:
            price = row["open"] * (1 + slip)
            units = position_size(cash, price, allocation, fee)
            commission = units * price * fee
            entry_cost = units * price + commission
            cash -= entry_cost
            fees += commission
            trades.append({"date": row["date"], "side": "Achat", "price": price, "quantity": units, "fee": commission})
        elif not signal and units:
            price = row["open"] * (1 - slip)
            commission = units * price * fee
            proceeds = units * price - commission
            cash += proceeds
            fees += commission
            outcomes.append(proceeds - entry_cost)
            trades.append({"date": row["date"], "side": "Vente", "price": price, "quantity": units, "fee": commission})
            units = 0.
        if i == len(rows)-1 and units:
            price = row["close"] * (1 - slip)
            commission = units * price * fee
            proceeds = units * price - commission
            cash += proceeds
            fees += commission
            outcomes.append(proceeds-entry_cost)
            trades.append({"date": row["date"], "side": "Clôture finale", "price": price, "quantity": units, "fee": commission})
            units = 0.
        equity = cash + units * row["close"]
        peak = max(peak, equity)
        drawdown = max(drawdown, (peak-equity)/peak)
        curve.append({"date": row["date"], "equity": round(equity, 2)})
    return {"final_equity": round(cash,2), "return_pct": (cash/capital-1)*100,
            "max_drawdown_pct": drawdown*100, "fees": round(fees,2),
            "completed_trades": len(outcomes), "win_rate_pct": 100*sum(x>0 for x in outcomes)/len(outcomes) if outcomes else None,
            "curve": curve, "trades": trades}

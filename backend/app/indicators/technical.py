import math
import numpy as np
import pandas as pd


def wilder(series, period=14):
    out = pd.Series(np.nan, index=series.index, dtype=float)
    valid = series.dropna()
    if len(valid) < period:
        return out
    first = valid.index[period - 1]
    out.loc[first] = float(valid.iloc[:period].mean())
    previous = out.loc[first]
    for idx, value in valid.iloc[period:].items():
        previous = (previous * (period - 1) + value) / period
        out.loc[idx] = previous
    return out


def enrich(rows):
    if not rows:
        return []
    df = pd.DataFrame(rows)
    c = df.close.astype(float)
    df["sma20"] = c.rolling(20, min_periods=20).mean()
    df["ema20"] = c.ewm(span=20, adjust=False, min_periods=20).mean()
    df["ema50"] = c.ewm(span=50, adjust=False, min_periods=50).mean()
    delta = c.diff()
    gain = wilder(delta.clip(lower=0))
    loss = wilder(-delta.clip(upper=0))
    df["rsi"] = 100 - 100 / (1 + gain / loss)
    df.loc[(loss == 0) & (gain > 0), "rsi"] = 100
    df.loc[(loss == 0) & (gain == 0), "rsi"] = 50
    df["macd"] = (
        c.ewm(span=12, adjust=False, min_periods=12).mean()
        - c.ewm(span=26, adjust=False, min_periods=26).mean()
    )
    df["macd_signal"] = df.macd.ewm(span=9, adjust=False, min_periods=9).mean()
    df["macd_histogram"] = df.macd - df.macd_signal
    tr = pd.concat(
        [df.high - df.low, (df.high - c.shift()).abs(), (df.low - c.shift()).abs()],
        axis=1,
    ).max(axis=1)
    df["atr"] = wilder(tr)
    std = c.rolling(20, min_periods=20).std(ddof=0)
    df["bb_upper"] = df.sma20 + 2 * std
    df["bb_lower"] = df.sma20 - 2 * std
    return [
        {
            k: None if isinstance(v, float) and not math.isfinite(v) else v
            for k, v in row.items()
        }
        for row in df.to_dict("records")
    ]

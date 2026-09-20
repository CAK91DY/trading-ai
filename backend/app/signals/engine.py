"""Turns an active strategy's rules into a single BUY/SELL/WAIT reading on the latest bar."""

import pandas as pd
from app.strategies.ema import ema
from app.indicators.technical import wilder
from app.strategies.rules import OPS


def _detail(rules, values):
    out = []
    for rule in rules:
        left = values[rule["indicator"]]
        right = (
            values[rule["value"]] if isinstance(rule["value"], str) else rule["value"]
        )
        passed = (
            False
            if pd.isna(left) or pd.isna(right)
            else OPS[rule["operator"]](left, right)
        )
        out.append(
            {
                **rule,
                "actual": None if pd.isna(left) else round(float(left), 4),
                "passed": bool(passed),
            }
        )
    return out


def detect(closes, definition):
    fast, slow = ema(closes, definition["fast"]), ema(closes, definition["slow"])
    delta = pd.Series(closes, dtype=float).diff()
    gain, loss = wilder(delta.clip(lower=0)), wilder(-delta.clip(upper=0))
    rsi = 100 - 100 / (1 + gain / loss)
    rsi[(loss == 0) & (gain > 0)] = 100
    rsi[(loss == 0) & (gain == 0)] = 50
    i = len(closes) - 1
    values = dict(ema_fast=fast[i], ema_slow=slow[i], rsi=rsi.iloc[i])
    uses_rsi = any(
        r["indicator"] == "rsi" for r in definition["entry"] + definition["exit"]
    )
    ready = i >= max(definition["slow"] - 1, 14 if uses_rsi else 0)
    entry = _detail(definition["entry"], values)
    exit_ = _detail(definition["exit"], values)
    entry_ok = ready and (
        all(r["passed"] for r in entry)
        if definition["entry_mode"] == "all"
        else any(r["passed"] for r in entry)
    )
    exit_ok = ready and (
        all(r["passed"] for r in exit_)
        if definition["exit_mode"] == "all"
        else any(r["passed"] for r in exit_)
    )
    # Exit takes priority when both groups hold, mirroring the backtesting engine.
    side = "SELL" if exit_ok else "BUY" if entry_ok else "WAIT"
    return {
        "ready": ready,
        "side": side,
        "indicators": {
            k: (None if pd.isna(v) else round(float(v), 4)) for k, v in values.items()
        },
        "entry": entry,
        "exit": exit_,
    }

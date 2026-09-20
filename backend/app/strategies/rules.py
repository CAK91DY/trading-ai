"""Safe, typed comparisons: no user expression is ever evaluated as code."""

import operator
import pandas as pd
from app.strategies.ema import ema
from app.indicators.technical import wilder

OPS = {">": operator.gt, ">=": operator.ge, "<": operator.lt, "<=": operator.le}


def evaluate(rules, mode, values):
    results = []
    for rule in rules:
        left = values[rule["indicator"]]
        right = (
            values[rule["value"]] if isinstance(rule["value"], str) else rule["value"]
        )
        results.append(
            False
            if pd.isna(left) or pd.isna(right)
            else OPS[rule["operator"]](left, right)
        )
    return all(results) if mode == "all" else any(results)


def decisions(closes, definition):
    fast, slow = ema(closes, definition["fast"]), ema(closes, definition["slow"])
    delta = pd.Series(closes, dtype=float).diff()
    gain, loss = wilder(delta.clip(lower=0)), wilder(-delta.clip(upper=0))
    rsi = 100 - 100 / (1 + gain / loss)
    rsi[(loss == 0) & (gain > 0)] = 100
    rsi[(loss == 0) & (gain == 0)] = 50
    entries, exits = [], []
    uses_rsi = any(
        r["indicator"] == "rsi" for r in definition["entry"] + definition["exit"]
    )
    ready = max(definition["slow"] - 1, 14 if uses_rsi else 0)
    for i in range(len(closes)):
        values = dict(ema_fast=fast[i], ema_slow=slow[i], rsi=rsi.iloc[i])
        entries.append(
            i >= ready
            and evaluate(definition["entry"], definition["entry_mode"], values)
        )
        exits.append(
            i >= ready and evaluate(definition["exit"], definition["exit_mode"], values)
        )
    return entries, exits

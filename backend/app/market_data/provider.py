import math
import threading
from typing import Protocol
import yfinance as yf
from app.core.config import settings


class MarketProvider(Protocol):
    def history(self, symbol: str, interval: str) -> list[dict]: ...


class YahooProvider:
    """Research adapter. No exchange real-time entitlement; do not claim live prices."""

    def __init__(self):
        path = settings.work_dir / "yfinance"
        path.mkdir(parents=True, exist_ok=True)
        yf.set_tz_cache_location(str(path))

    def history(self, symbol, interval):
        frame = yf.Ticker(symbol).history(
            period="5d" if interval == "5m" else "10y",
            interval=interval,
            auto_adjust=True,
            actions=False,
            raise_errors=True,
            timeout=15,
        )
        if frame.empty:
            raise ValueError("Le fournisseur n’a retourné aucune donnée.")
        rows = []
        for timestamp, row in frame.iterrows():
            vals = [
                float(row[key]) for key in ["Open", "High", "Low", "Close", "Volume"]
            ]
            if (
                not all(math.isfinite(x) for x in vals)
                or min(vals[:4]) <= 0
                or vals[4] < 0
            ):
                continue
            if vals[1] < max(vals[0], vals[2], vals[3]) or vals[2] > min(
                vals[0], vals[1], vals[3]
            ):
                continue
            rows.append(
                dict(
                    zip(
                        ["timestamp", "open", "high", "low", "close", "volume"],
                        [timestamp.isoformat(), *vals],
                    )
                )
            )
        if not rows:
            raise ValueError("Aucune bougie OHLCV valide.")
        return sorted(
            {r["timestamp"]: r for r in rows}.values(), key=lambda r: r["timestamp"]
        )


provider = YahooProvider()
locks = {}
registry_lock = threading.Lock()


def asset_lock(key):
    with registry_lock:
        return locks.setdefault(key, threading.Lock())

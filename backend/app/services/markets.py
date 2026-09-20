import time
import math
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy import select, delete
from app.models.entities import MarketPrice, MarketFetch
from app.market_data import provider as source
from app.core.config import settings
from app.indicators.technical import enrich

FIELDS = ["timestamp", "open", "high", "low", "close", "volume"]


def history(db, asset, interval="1d"):
    key = f"{asset.symbol}:{interval}"
    with source.asset_lock(key):
        stamp = db.get(MarketFetch, key)
        fresh = stamp and time.time() - stamp.fetched_at < (
            60 if interval == "5m" else settings.data_cache_minutes * 60
        )
        warning = None
        if not fresh:
            try:
                bars = source.provider.history(asset.symbol, interval)
                db.execute(
                    delete(MarketPrice).where(
                        MarketPrice.symbol == asset.symbol,
                        MarketPrice.interval == interval,
                    )
                )
                db.add_all(
                    [
                        MarketPrice(symbol=asset.symbol, interval=interval, **bar)
                        for bar in bars
                    ]
                )
                if not stamp:
                    stamp = MarketFetch(key=key, fetched_at=time.time())
                    db.add(stamp)
                else:
                    stamp.fetched_at = time.time()
                db.commit()
            except Exception:
                db.rollback()
                warning = "Fournisseur indisponible : dernières données enregistrées affichées."
        rows = db.scalars(
            select(MarketPrice)
            .where(MarketPrice.symbol == asset.symbol, MarketPrice.interval == interval)
            .order_by(MarketPrice.timestamp)
        ).all()
        stamp = db.get(MarketFetch, key)
        if not rows:
            raise ValueError(
                "Données indisponibles auprès du fournisseur. Réessayez plus tard."
            )
        return [{k: getattr(row, k) for k in FIELDS} for row in rows], {
            "source": "Yahoo Finance via yfinance",
            "adjustment": "OHLC ajustés",
            "fetched_at": stamp.fetched_at if stamp else None,
            "stale": bool(warning),
            "warning": warning,
            "interval": interval,
            "realtime": False,
        }


def overview(db, asset):
    result = {
        key: getattr(asset, key)
        for key in ["symbol", "name", "kind", "currency", "exchange", "sector"]
    }
    try:
        rows, meta = history(db, asset)
        last = rows[-1]
        prev = rows[-2]["close"] if len(rows) > 1 else None
        closes = np.array([r["close"] for r in rows[-31:]])
        returns = closes[1:] / closes[:-1] - 1
        volatility = (
            float(np.std(returns, ddof=1) * math.sqrt(252) * 100)
            if len(returns) > 1
            else None
        )
        result.update(
            price=last["close"],
            change=last["close"] - prev if prev else None,
            change_pct=(last["close"] / prev - 1) * 100 if prev else None,
            volume=last["volume"],
            volatility=volatility,
            as_of=last["timestamp"],
            signal=None,
            meta=meta,
            sparkline=[r["close"] for r in rows[-30:]],
            error=None,
        )
    except ValueError as exc:
        result.update(
            price=None,
            change=None,
            change_pct=None,
            volume=None,
            volatility=None,
            as_of=None,
            signal=None,
            meta=None,
            sparkline=[],
            error=str(exc),
        )
    return result


PERIOD_DAYS = {"1W": 7, "1M": 31, "3M": 93, "6M": 186, "1Y": 366, "5Y": 1830}


def asset_history(db, asset, period):
    rows, meta = history(db, asset, "5m" if period == "1D" else "1d")
    points = enrich(rows)
    # Calculate indicators before slicing, preserving sufficient warm-up history.
    end = datetime.fromisoformat(rows[-1]["timestamp"])
    if period == "1D":
        points = [
            r
            for r in points
            if datetime.fromisoformat(r["timestamp"]).date() == end.date()
        ]
    else:
        start = end - timedelta(days=PERIOD_DAYS[period])
        points = [r for r in points if datetime.fromisoformat(r["timestamp"]) >= start]
    meta.update(
        as_of=rows[-1]["timestamp"],
        period_anchor="Dernière séance disponible",
        is_delayed=True,
    )
    return {
        "symbol": asset.symbol,
        "currency": asset.currency,
        "period": period,
        "meta": meta,
        "points": points,
    }

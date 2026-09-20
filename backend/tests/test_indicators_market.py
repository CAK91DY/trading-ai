from datetime import datetime, timedelta, timezone
import pytest
from app.indicators.technical import enrich
from app.services.markets import history
from app.models.entities import Asset, MarketFetch
from app.market_data import provider as source


def bars(n=100):
    return [
        {
            "timestamp": (
                datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=i)
            ).isoformat(),
            "open": 100.0 + i,
            "high": 102.0 + i,
            "low": 98.0 + i,
            "close": 100.0 + i,
            "volume": 1000.0,
        }
        for i in range(n)
    ]


def test_indicator_known_linear_series():
    result = enrich(bars())
    assert result[18]["sma20"] is None
    assert result[19]["sma20"] == pytest.approx(109.5)
    assert result[-1]["rsi"] == pytest.approx(100)
    assert result[-1]["atr"] == pytest.approx(4)
    assert result[48]["ema50"] is None
    assert result[-1]["macd"] == pytest.approx(7, abs=0.02)
    assert result[-1]["bb_upper"] > result[-1]["sma20"] > result[-1]["bb_lower"]


def test_flat_rsi_and_bands():
    rows = bars()
    for row in rows:
        row.update(open=100.0, high=100.0, low=100.0, close=100.0)
    last = enrich(rows)[-1]
    assert last["rsi"] == 50
    assert last["atr"] == 0
    assert last["bb_upper"] == last["bb_lower"] == 100


def test_no_indicator_future_leakage():
    rows = bars()
    expected = enrich(rows)[:50]
    rows[60]["close"] = 10000
    assert enrich(rows)[:50] == expected


def test_cache_and_explicit_stale_fallback(client, account, factory, monkeypatch):
    calls = []
    monkeypatch.setattr(
        source.provider,
        "history",
        lambda symbol, interval: calls.append(symbol) or bars(),
    )
    with factory() as db:
        asset = db.get(Asset, "AAPL")
        first, meta = history(db, asset)
        assert not meta["stale"]
        second, _ = history(db, asset)
        assert first == second and len(calls) == 1
        db.get(MarketFetch, "AAPL:1d").fetched_at = 0
        db.commit()

        def fail(*args):
            raise RuntimeError("provider failure")

        monkeypatch.setattr(source.provider, "history", fail)
        cached, meta = history(db, asset)
        assert cached == first and meta["stale"] and meta["warning"]
        with pytest.raises(ValueError):
            history(db, db.get(Asset, "MSFT"))


def test_market_api_filters_and_periods(client, account, monkeypatch):
    monkeypatch.setattr(source.provider, "history", lambda *args: bars(400))
    response = client.get("/api/markets?q=Apple&kind=stock")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    a = response.json()["items"][0]
    assert a["symbol"] == "AAPL" and a["price"] == 499
    assert a["meta"]["realtime"] is False
    history = client.get("/api/assets/AAPL/history?period=1M").json()
    assert 28 <= len(history["points"]) <= 32
    assert history["points"][0]["ema50"] is not None
    assert client.get("/api/assets/NOPE").status_code == 404
    assert client.get("/api/assets/AAPL/history?period=bad").status_code == 422


def test_unavailable_market_is_not_fabricated(client, account, monkeypatch):
    def fail(*args):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(source.provider, "history", fail)
    item = client.get("/api/markets?q=AAPL").json()["items"][0]
    assert item["price"] is None and item["error"]
    assert client.get("/api/assets/AAPL/history").status_code == 503

import math
from datetime import date, timedelta

import pytest

from app.signals.engine import detect


def rising_candles(n=120):
    return [
        dict(
            timestamp=(date(2024, 1, 1) + timedelta(days=i)).isoformat(),
            open=100 + i,
            close=101 + i,
            high=102 + i,
            low=99 + i,
            volume=1000,
        )
        for i in range(n)
    ]


def oscillating_candles(n=40):
    return [
        dict(
            timestamp=(date(2024, 1, 1) + timedelta(days=i)).isoformat(),
            open=100 + 5 * math.sin(i / 3),
            close=100 + 5 * math.sin(i / 3),
            high=105 + 5 * math.sin(i / 3),
            low=95 + 5 * math.sin(i / 3),
            volume=1000,
        )
        for i in range(n)
    ]


def install_market(monkeypatch, candles):
    from app.services import markets

    monkeypatch.setattr(
        markets,
        "history",
        lambda *args: (
            candles,
            {
                "source": "test fixture",
                "stale": False,
                "warning": None,
                "interval": "1d",
                "adjustment": "OHLC ajustés",
                "realtime": False,
                "fetched_at": 1,
            },
        ),
    )


def trend_definition(**overrides):
    return {
        "fast": 2,
        "slow": 3,
        "entry_mode": "all",
        "exit_mode": "any",
        "entry": [{"indicator": "ema_fast", "operator": ">", "value": "ema_slow"}],
        "exit": [{"indicator": "ema_fast", "operator": "<=", "value": "ema_slow"}],
        **overrides,
    }


def rsi_definition(**overrides):
    return {
        "fast": 2,
        "slow": 3,
        "entry_mode": "all",
        "exit_mode": "all",
        "entry": [{"indicator": "rsi", "operator": ">", "value": 99}],
        "exit": [{"indicator": "rsi", "operator": "<", "value": 1}],
        **overrides,
    }


def strategy_body(definition):
    return {"name": "Test strategy", "active": True, "definition": definition}


def test_detect_buy_on_uptrend():
    closes = [r["close"] for r in rising_candles()]
    reading = detect(closes, trend_definition())
    assert reading["ready"] is True
    assert reading["side"] == "BUY"
    assert reading["entry"][0]["passed"] is True
    assert reading["exit"][0]["passed"] is False


def test_detect_not_ready_with_short_history():
    reading = detect([100, 101], trend_definition())
    assert reading["ready"] is False
    assert reading["side"] == "WAIT"


def test_detect_wait_when_no_rule_holds():
    closes = [r["close"] for r in oscillating_candles()]
    reading = detect(closes, rsi_definition())
    assert reading["ready"] is True
    assert reading["side"] == "WAIT"
    assert reading["indicators"]["rsi"] is not None
    assert 1 < reading["indicators"]["rsi"] < 99


def test_scan_requires_auth(client):
    assert client.post("/api/signals/scan", json={"strategy_id": "x", "symbol": "AAPL"}).status_code == 401


def test_scan_rejects_missing_strategy(client, account):
    r = client.post("/api/signals/scan", json={"strategy_id": "missing", "symbol": "AAPL"})
    assert r.status_code == 404


def test_scan_rejects_inactive_strategy(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles())
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    client.patch(f"/api/strategies/{strategy['id']}", json=strategy_body(trend_definition()) | {"active": False})
    r = client.post(
        "/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "AAPL"}
    )
    assert r.status_code == 422


def test_scan_rejects_unknown_asset(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles())
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    r = client.post(
        "/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "NOPE"}
    )
    assert r.status_code == 404


def test_scan_rejects_insufficient_history(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles(2))
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    r = client.post(
        "/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "AAPL"}
    )
    assert r.status_code == 422


def test_scan_persists_and_lists_signal(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles())
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    r = client.post(
        "/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "AAPL"}
    )
    assert r.status_code == 201, r.text
    signal = r.json()
    assert signal["side"] == "BUY"
    assert signal["status"] == "DETECTED"
    assert signal["strategy_snapshot"]["name"] == "Test strategy"
    assert signal["symbol"] == "AAPL"
    listed = client.get("/api/signals").json()
    assert listed == [signal]


def test_signals_are_isolated_per_user(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles())
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    client.post("/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "AAPL"})
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Another-password-123"},
    )
    assert client.get("/api/signals").json() == []


def test_scan_rejects_other_users_strategy(client, account, monkeypatch):
    install_market(monkeypatch, rising_candles())
    strategy = client.post("/api/strategies", json=strategy_body(trend_definition())).json()
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Another-password-123"},
    )
    r = client.post(
        "/api/signals/scan", json={"strategy_id": strategy["id"], "symbol": "AAPL"}
    )
    assert r.status_code == 404

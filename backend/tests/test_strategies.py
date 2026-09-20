from datetime import date, timedelta

import pytest

from app.strategies.rules import decisions


def candles():
    return [
        dict(
            timestamp=(date(2024, 1, 1) + timedelta(days=i)).isoformat(),
            open=100 + i,
            close=101 + i,
            high=102 + i,
            low=99 + i,
            volume=1000,
        )
        for i in range(120)
    ]


@pytest.fixture
def market(monkeypatch):
    from app.services import markets

    monkeypatch.setattr(
        markets,
        "history",
        lambda *args: (
            candles(),
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


def definition(**overrides):
    return {
        "fast": 2,
        "slow": 3,
        "entry_mode": "all",
        "exit_mode": "any",
        "entry": [{"indicator": "ema_fast", "operator": ">", "value": "ema_slow"}],
        "exit": [{"indicator": "ema_fast", "operator": "<=", "value": "ema_slow"}],
        **overrides,
    }


def body(**overrides):
    return {"name": "EMA Momentum", "active": True, "definition": definition(), **overrides}


def test_create_requires_auth(client):
    assert client.post("/api/strategies", json=body()).status_code == 401


def test_crud_lifecycle(client, account):
    created = client.post("/api/strategies", json=body())
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["active"] is True
    assert client.get("/api/strategies").json() == [row]

    updated = client.patch(
        f"/api/strategies/{row['id']}", json=body(name="EMA Momentum v2", active=False)
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "EMA Momentum v2"
    assert updated.json()["active"] is False

    assert client.delete(f"/api/strategies/{row['id']}").status_code == 204
    assert client.get("/api/strategies").json() == []


def test_strategies_are_isolated_per_user(client, account):
    client.post("/api/strategies", json=body())
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Another-password-123"},
    )
    assert client.get("/api/strategies").json() == []


def test_owned_rejects_other_users_strategy(client, account):
    row = client.post("/api/strategies", json=body()).json()
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Another-password-123"},
    )
    assert client.patch(f"/api/strategies/{row['id']}", json=body()).status_code == 404
    assert client.delete(f"/api/strategies/{row['id']}").status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"fast": 5, "slow": 5},
        {"entry": []},
        {"entry": [{"indicator": "rsi", "operator": ">", "value": 150}]},
        {"entry": [{"indicator": "ema_fast", "operator": ">", "value": "ema_fast"}]},
    ],
)
def test_invalid_definitions_are_rejected(client, account, overrides):
    assert client.post("/api/strategies", json=body(definition=definition(**overrides))).status_code == 422


def test_decisions_all_mode_requires_every_rule():
    closes = [10, 11, 12, 13, 14, 13, 12, 11, 10, 9, 10, 11, 12, 13, 14, 15]
    d = definition(
        entry_mode="all",
        entry=[
            {"indicator": "ema_fast", "operator": ">", "value": "ema_slow"},
            {"indicator": "rsi", "operator": ">", "value": 90},
        ],
    )
    entries, _exits = decisions(closes, d)
    assert not any(entries)


def test_backtest_market_uses_active_strategy_snapshot(client, account, market):
    strategy = client.post("/api/strategies", json=body()).json()
    run = client.post(
        "/api/backtests/market",
        json={
            "symbol": "AAPL",
            "strategy_id": strategy["id"],
            "start": "2024-03-01",
            "end": "2024-04-01",
        },
    )
    assert run.status_code == 201, run.text
    payload = run.json()
    assert payload["strategy"] == "rules_v1"
    assert payload["strategy_snapshot"]["name"] == "EMA Momentum"
    assert payload["strategy_snapshot"]["definition"] == strategy["definition"]


def test_backtest_market_rejects_inactive_strategy(client, account, market):
    strategy = client.post("/api/strategies", json=body(active=False)).json()
    run = client.post(
        "/api/backtests/market",
        json={
            "symbol": "AAPL",
            "strategy_id": strategy["id"],
            "start": "2024-03-01",
            "end": "2024-04-01",
        },
    )
    assert run.status_code == 422


def test_backtest_market_rejects_other_users_strategy(client, account, market):
    strategy = client.post("/api/strategies", json=body()).json()
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Another-password-123"},
    )
    run = client.post(
        "/api/backtests/market",
        json={
            "symbol": "AAPL",
            "strategy_id": strategy["id"],
            "start": "2024-03-01",
            "end": "2024-04-01",
        },
    )
    assert run.status_code == 404

from datetime import date, timedelta
import pytest
from sqlalchemy import select
from app.backtesting.engine import run_backtest
from app.models.entities import Experiment


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


def request(**extra):
    return {
        "symbol": "AAPL",
        "start": "2024-03-01",
        "end": "2024-04-01",
        "fast": 2,
        "slow": 3,
        **extra,
    }


def test_real_data_path_freezes_input_and_initializes_before_window(
    client, account, market, factory
):
    r = client.post("/api/backtests/market", json=request())
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["warmup_bars"] == 60
    assert run["bars"] == 32
    assert run["trades"][0]["date"] == "2024-03-01"
    assert run["curve"][0]["date"] == "2024-03-01"
    assert run["end"] == "2024-04-01"
    assert run["currency"] == "USD"
    assert "input_rows" not in run
    with factory() as db:
        payload = db.scalar(select(Experiment)).payload
        assert len(payload["input_rows"]) == 92
        assert len(payload["data_sha256"]) == 64
    assert client.get("/api/backtests").json()[0] == run
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": "Another-password-123",
        },
    )
    assert client.get("/api/backtests").json() == []


@pytest.mark.parametrize(
    "changes",
    [
        {"start": "2024-04-02"},
        {"end": "2999-01-01"},
        {"fast": 4, "slow": 3},
        {"start": "2024-01-01"},
        {"start": "2024-05-01", "end": "2024-06-01"},
        {"allocation": 2},
    ],
)
def test_invalid_market_backtests(client, account, market, changes):
    assert (
        client.post("/api/backtests/market", json=request(**changes)).status_code == 422
    )


def test_provider_failure_does_not_save_result(client, account, monkeypatch):
    from app.services import markets

    def fail(*args):
        raise ValueError("Source indisponible")

    monkeypatch.setattr(markets, "history", fail)
    assert client.post("/api/backtests/market", json=request()).status_code == 503
    assert client.get("/api/backtests").json() == []


def test_warmup_has_no_trades_or_future_lookahead():
    rows = [
        dict(date=r["timestamp"], open=r["open"], close=r["close"]) for r in candles()
    ]
    result = run_backtest(rows, fast=2, slow=3, start_index=60)
    changed = [dict(r) for r in rows]
    for r in changed[90:]:
        r["close"] = 1
        r["open"] = 1
    altered = run_backtest(changed, fast=2, slow=3, start_index=60)
    assert result["curve"][:30] == altered["curve"][:30]
    assert min(t["date"] for t in result["trades"]) == rows[60]["date"]
    assert len(result["curve"]) == 60
    assert result["winning_trades"] == 1
    assert result["losing_trades"] == 0
    assert result["profit_factor"] is None
    assert result["average_win"] == pytest.approx(
        result["final_equity"] - 10000, abs=0.01
    )
    assert result["sharpe_ratio"] is not None

import pytest
from app.backtesting.engine import run_backtest
from app.market_data.csv_data import parse_csv

def rows(prices):
    return [{"date": f"2026-01-{i+1:02d}", "open": p, "close": p} for i,p in enumerate(prices)]

def test_flat_no_trades():
    result=run_backtest(rows([100]*10), fast=2, slow=3)
    assert result["final_equity"] == 10000
    assert result["completed_trades"] == 0
    assert result["win_rate_pct"] is None

def test_next_open_fees_and_final_liquidation():
    result=run_backtest(rows([10,11,12,13,14,15]),fast=2,slow=3,fee_bps=100,slippage_bps=100,allocation=1)
    buy,sell=result["trades"]
    assert buy["date"] == "2026-01-04"
    assert buy["price"] == pytest.approx(13*1.01)
    qty=10000/(13*1.01*1.01)
    assert result["final_equity"] == pytest.approx(qty*15*.99*.99,abs=.01)
    assert sell["side"] == "Clôture finale"
    assert result["fees"] > 0

def test_no_future_leakage():
    a=rows([10,11,12,13,14,15,16,17])
    b=rows([10,11,12,13,14,1,1,1])
    assert run_backtest(a,fast=2,slow=3)["curve"][:5] == run_backtest(b,fast=2,slow=3)["curve"][:5]

@pytest.mark.parametrize("csv", ["date,open,close\n2026-01-01,nan,2", "date,open,close\n2026-01-01,0,2", "date,open,close\n2026-01-02,1,2\n2026-01-01,1,2"])
def test_invalid_data(csv):
    with pytest.raises(ValueError): parse_csv(csv)

def test_api_validation_and_persistence(tmp_path,monkeypatch):
    from sqlalchemy import create_engine
    from fastapi.testclient import TestClient
    from app.api import main
    monkeypatch.setattr(main,"engine",create_engine(f"sqlite:///{tmp_path}/test.db"))
    with TestClient(main.app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.post("/api/backtests",json={"csv":"bad"}).status_code == 422
        csv="date,open,close\n"+"\n".join(f"2026-01-{i+1:02d},{10+i},{10+i}" for i in range(8))
        response=client.post("/api/backtests",json={"csv":csv,"fast":2,"slow":3})
        assert response.status_code == 201
        assert client.get("/api/backtests").json()[0]["id"] == response.json()["id"]

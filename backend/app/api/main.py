import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, MetaData, Table, Column, String, JSON, select
from app.market_data.csv_data import parse_csv
from app.backtesting.engine import run_backtest

engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///./trading.db"))
metadata = MetaData()
runs = Table("backtests", metadata, Column("id", String, primary_key=True), Column("created_at", String), Column("payload", JSON))

@asynccontextmanager
async def lifespan(app):
    metadata.create_all(engine)
    yield

app = FastAPI(title="Trading AI · Recherche", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class BacktestRequest(BaseModel):
    name: str = Field(default="Mon historique", min_length=1, max_length=80)
    csv: str = Field(max_length=2_000_000)
    capital: float = Field(default=10000, ge=100, le=1e9, allow_inf_nan=False)
    fast: int = Field(default=20, ge=2, le=500)
    slow: int = Field(default=50, ge=3, le=1000)
    fee_bps: float = Field(default=10, ge=0, le=500, allow_inf_nan=False)
    slippage_bps: float = Field(default=5, ge=0, le=500, allow_inf_nan=False)
    allocation: float = Field(default=.2, gt=0, le=1, allow_inf_nan=False)

@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(select(1))
    return {"status": "ok", "mode": "simulation"}

@app.get("/api/backtests")
def history():
    with engine.connect() as connection:
        return [row.payload for row in connection.execute(select(runs).order_by(runs.c.created_at.desc()).limit(30))]

@app.post("/api/backtests", status_code=201)
def create_backtest(request: BacktestRequest):
    try:
        rows = parse_csv(request.csv)
        result = run_backtest(rows, **request.model_dump(exclude={"name", "csv"}))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    result.update(id=str(uuid4()), created_at=datetime.now(timezone.utc).isoformat(), name=request.name,
                  parameters=request.model_dump(exclude={"csv"}), start=rows[0]["date"], end=rows[-1]["date"], bars=len(rows))
    with engine.begin() as connection:
        connection.execute(runs.insert().values(id=result["id"], created_at=result["created_at"], payload=result))
    return result

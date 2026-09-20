from uuid import uuid4
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import Experiment, User
from app.market_data.csv_data import parse_csv
from app.backtesting.engine import run_backtest

router = APIRouter(prefix="/api/backtests", tags=["Backtests"])


class Parameters(BaseModel):
    name: str = Field(default="EMA Momentum", min_length=1, max_length=80)
    capital: float = Field(default=10000, ge=100, le=1e9, allow_inf_nan=False)
    fast: int = Field(default=20, ge=2, le=500)
    slow: int = Field(default=50, ge=3, le=1000)
    fee_bps: float = Field(default=10, ge=0, le=500, allow_inf_nan=False)
    slippage_bps: float = Field(default=5, ge=0, le=500, allow_inf_nan=False)
    allocation: float = Field(default=0.2, gt=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_periods(self):
        if self.fast >= self.slow:
            raise ValueError("EMA rapide doit être inférieure à EMA lente.")
        if not self.name.strip():
            raise ValueError("Nom requis.")
        self.name = self.name.strip()
        return self


class BacktestRequest(Parameters):
    csv: str = Field(max_length=2_000_000)


class MarketBacktestRequest(Parameters):
    symbol: str = Field(min_length=1, max_length=20)
    start: date
    end: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start >= self.end:
            raise ValueError("La date de début doit précéder la date de fin.")
        if self.end >= datetime.now(timezone.utc).date():
            raise ValueError(
                "Choisissez une date de fin antérieure à aujourd’hui (séances complètes)."
            )
        return self


@router.post("/market", status_code=201)
def create_market(
    body: MarketBacktestRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    import hashlib
    import json
    from app.api.markets import asset_or_404
    from app.services.markets import history as market_history
    from app.models.entities import AuditLog

    asset = asset_or_404(db, body.symbol)
    try:
        data, meta = market_history(db, asset, "1d")
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc
    # Keep prior candles for EMA initialization; never trade outside the requested window.
    rows = [
        {"date": r["timestamp"][:10], "open": r["open"], "close": r["close"]}
        for r in data
        if date.fromisoformat(r["timestamp"][:10]) <= body.end
    ]
    start_index = next(
        (i for i, r in enumerate(rows) if date.fromisoformat(r["date"]) >= body.start),
        len(rows),
    )
    if len(rows) - start_index < 2:
        raise HTTPException(
            422, "Au moins deux séances disponibles sont nécessaires dans la période."
        )
    if start_index < body.slow:
        raise HTTPException(
            422,
            "Historique antérieur insuffisant pour initialiser les EMA. Choisissez un début plus récent ou une EMA lente plus courte.",
        )
    result = run_backtest(
        rows,
        start_index=start_index,
        **body.model_dump(exclude={"name", "symbol", "start", "end"}),
    )
    result.update(
        id=str(uuid4()),
        created_at=datetime.now(timezone.utc).isoformat(),
        name=body.name,
        symbol=asset.symbol,
        currency=asset.currency,
        parameters=body.model_dump(mode="json"),
        strategy="ema_trend_v1",
        start=rows[start_index]["date"],
        end=rows[-1]["date"],
        bars=len(rows) - start_index,
        warmup_bars=start_index,
        market_meta=meta,
        data_sha256=hashlib.sha256(
            json.dumps(rows, sort_keys=True).encode()
        ).hexdigest(),
        # Freeze the precise adjusted input: future provider revisions must not change this experiment.
        input_rows=rows,
    )
    db.add(Experiment(id=result["id"], user_id=user.id, payload=result))
    db.add(
        AuditLog(
            user_id=user.id,
            event="backtest.market.completed",
            details={"id": result["id"], "symbol": asset.symbol},
        )
    )
    db.commit()
    return {k: v for k, v in result.items() if k != "input_rows"}


@router.get("")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        {k: v for k, v in r.payload.items() if k != "input_rows"}
        for r in db.scalars(
            select(Experiment)
            .where(Experiment.user_id == user.id)
            .order_by(Experiment.created_at.desc())
            .limit(30)
        )
    ]


@router.post("", status_code=201)
def create(
    body: BacktestRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    try:
        rows = parse_csv(body.csv)
        result = run_backtest(rows, **body.model_dump(exclude={"name", "csv"}))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    result.update(
        id=str(uuid4()),
        created_at=datetime.now(timezone.utc).isoformat(),
        name=body.name,
        parameters=body.model_dump(exclude={"csv"}),
        start=rows[0]["date"],
        end=rows[-1]["date"],
        bars=len(rows),
    )
    db.add(Experiment(id=result["id"], user_id=user.id, payload=result))
    db.commit()
    return result

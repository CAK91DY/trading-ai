from uuid import uuid4
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import Experiment, User
from app.market_data.csv_data import parse_csv
from app.backtesting.engine import run_backtest

router = APIRouter(prefix="/api/backtests", tags=["Backtests existants"])


class BacktestRequest(BaseModel):
    name: str = Field(default="Mon historique", min_length=1, max_length=80)
    csv: str = Field(max_length=2_000_000)
    capital: float = Field(default=10000, ge=100, le=1e9, allow_inf_nan=False)
    fast: int = Field(default=20, ge=2, le=500)
    slow: int = Field(default=50, ge=3, le=1000)
    fee_bps: float = Field(default=10, ge=0, le=500, allow_inf_nan=False)
    slippage_bps: float = Field(default=5, ge=0, le=500, allow_inf_nan=False)
    allocation: float = Field(default=0.2, gt=0, le=1, allow_inf_nan=False)


@router.get("")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        r.payload
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

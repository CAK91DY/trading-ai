from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import Signal, User, AuditLog
from app.schemas.signal import ScanRequest
from app.signals.engine import detect

router = APIRouter(prefix="/api/signals", tags=["Signaux"])


def view(row):
    return {
        k: getattr(row, k)
        for k in [
            "id",
            "strategy_id",
            "symbol",
            "date",
            "price",
            "side",
            "status",
            "strategy_snapshot",
            "indicators",
            "conditions",
            "created_at",
        ]
    }


@router.get("")
def lists(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        view(r)
        for r in db.scalars(
            select(Signal)
            .where(Signal.user_id == user.id)
            .order_by(Signal.created_at.desc())
            .limit(50)
        )
    ]


@router.post("/scan", status_code=201)
def scan(
    body: ScanRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from app.api.markets import asset_or_404
    from app.api.strategies import owned, view as strategy_view
    from app.services.markets import history as market_history

    strategy = owned(db, user, body.strategy_id)
    if not strategy.active:
        raise HTTPException(422, "Activez cette stratégie avant de détecter un signal.")
    asset = asset_or_404(db, body.symbol)
    try:
        data, _meta = market_history(db, asset, "1d")
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc
    if len(data) < 2:
        raise HTTPException(422, "Historique insuffisant pour détecter un signal.")
    reading = detect([r["close"] for r in data], strategy.definition)
    if not reading["ready"]:
        raise HTTPException(
            422,
            "Historique insuffisant pour initialiser les indicateurs de cette stratégie.",
        )
    row = Signal(
        user_id=user.id,
        strategy_id=strategy.id,
        symbol=asset.symbol,
        date=data[-1]["timestamp"][:10],
        price=data[-1]["close"],
        side=reading["side"],
        status="DETECTED",
        strategy_snapshot=strategy_view(strategy),
        indicators=reading["indicators"],
        conditions={
            "entry_mode": strategy.definition["entry_mode"],
            "exit_mode": strategy.definition["exit_mode"],
            "entry": reading["entry"],
            "exit": reading["exit"],
        },
    )
    db.add(row)
    db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            event="signal.detected",
            details={"id": row.id, "symbol": asset.symbol, "side": row.side},
        )
    )
    db.commit()
    return view(row)

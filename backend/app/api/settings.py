import time
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import current_user
from app.models.entities import MarketFetch, Asset
from app.services.markets import history

router = APIRouter(
    prefix="/api/settings", tags=["Paramètres"], dependencies=[Depends(current_user)]
)


@router.get("")
def status(db: Session = Depends(get_db)):
    last = db.scalar(select(func.max(MarketFetch.fetched_at)))
    return {
        "database": "PostgreSQL"
        if settings.database_url.startswith("postgresql")
        else "SQLite (local)",
        "market_data": {
            "provider": "Yahoo Finance via yfinance",
            "status": "Connected"
            if last and time.time() - last < 3600
            else "Non vérifié récemment",
            "last_fetch": last,
            "message": "Cours historiques ajustés, non garantis en temps réel.",
        },
        "ai": "Disconnected",
        "broker": "Disconnected",
        "mail_mode": settings.mail_mode,
    }


@router.post("/test-market")
def check(db: Session = Depends(get_db)):
    from fastapi import HTTPException

    asset = db.get(Asset, "AAPL")
    stamp = db.get(MarketFetch, "AAPL:1d")
    if stamp:
        stamp.fetched_at = 0
        db.commit()
    try:
        _, meta = history(db, asset)
        if meta["stale"]:
            raise ValueError("Source indisponible, cache conservé.")
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc
    return status(db)

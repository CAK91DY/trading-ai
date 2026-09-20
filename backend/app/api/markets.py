from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from typing import Literal
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import Asset
from app.services.markets import overview, asset_history

router = APIRouter(
    prefix="/api", tags=["Marchés"], dependencies=[Depends(current_user)]
)


def asset_or_404(db, symbol):
    asset = db.get(Asset, symbol.upper())
    if not asset:
        raise HTTPException(404, "Actif absent du catalogue MVP.")
    return asset


@router.get("/assets")
def assets(q: str = Query("", max_length=80), db: Session = Depends(get_db)):
    stmt = select(Asset)
    if q:
        stmt = stmt.where(or_(Asset.symbol.ilike(f"%{q}%"), Asset.name.ilike(f"%{q}%")))
    return [
        {
            k: getattr(a, k)
            for k in ["symbol", "name", "kind", "currency", "exchange", "sector"]
        }
        for a in db.scalars(stmt.order_by(Asset.symbol).limit(50))
    ]


@router.get("/markets")
def markets(
    q: str = Query("", max_length=80),
    kind: Literal["all", "stock", "etf"] = "all",
    sort: Literal["symbol", "name"] = "symbol",
    direction: Literal["asc", "desc"] = "asc",
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    stmt = select(Asset)
    if q:
        stmt = stmt.where(or_(Asset.symbol.ilike(f"%{q}%"), Asset.name.ilike(f"%{q}%")))
    if kind != "all":
        stmt = stmt.where(Asset.kind == kind)
    count = db.scalar(select(func.count()).select_from(stmt.subquery()))
    col = getattr(Asset, sort)
    items = db.scalars(
        stmt.order_by(col.desc() if direction == "desc" else col.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [overview(db, a) for a in items],
        "total": count,
        "page": page,
        "page_size": page_size,
        "universe": "Catalogue initial de 18 actions et ETF",
    }


@router.get("/assets/{symbol}")
def asset_detail(symbol: str, db: Session = Depends(get_db)):
    return overview(db, asset_or_404(db, symbol))


@router.get("/assets/{symbol}/history")
def prices(
    symbol: str,
    period: Literal["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"] = "1Y",
    db: Session = Depends(get_db),
):
    try:
        return asset_history(db, asset_or_404(db, symbol), period)
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc

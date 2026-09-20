from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import User, Watchlist, WatchlistAsset, AuditLog
from app.api.markets import asset_or_404
from app.services.markets import overview

router = APIRouter(prefix="/api/watchlists", tags=["Watchlists"])


class Name(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def trim(cls, v):
        if not v.strip():
            raise ValueError("Nom requis")
        return v.strip()


class Symbol(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)


def owned(db, user, id):
    row = db.scalar(
        select(Watchlist).where(Watchlist.id == id, Watchlist.user_id == user.id)
    )
    if not row:
        raise HTTPException(404, "Watchlist introuvable.")
    return row


def view(db, row):
    return {
        "id": row.id,
        "name": row.name,
        "symbols": list(
            db.scalars(
                select(WatchlistAsset.symbol)
                .where(WatchlistAsset.watchlist_id == row.id)
                .order_by(WatchlistAsset.symbol)
            )
        ),
    }


@router.get("")
def lists(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        view(db, row)
        for row in db.scalars(
            select(Watchlist)
            .where(Watchlist.user_id == user.id)
            .order_by(Watchlist.created_at)
        )
    ]


@router.post("", status_code=201)
def create(
    body: Name, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    if (
        db.scalar(
            select(func.count())
            .select_from(Watchlist)
            .where(Watchlist.user_id == user.id)
        )
        >= 20
    ):
        raise HTTPException(422, "Maximum 20 listes.")
    row = Watchlist(user_id=user.id, name=body.name)
    db.add(row)
    db.flush()
    db.add(AuditLog(user_id=user.id, event="watchlist.create", details={"id": row.id}))
    db.commit()
    return view(db, row)


@router.patch("/{id}")
def rename(
    id: str,
    body: Name,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = owned(db, user, id)
    row.name = body.name
    db.commit()
    return view(db, row)


@router.delete("/{id}", status_code=204)
def remove(id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = owned(db, user, id)
    db.delete(row)
    db.add(AuditLog(user_id=user.id, event="watchlist.delete", details={"id": id}))
    db.commit()


@router.post("/{id}/assets")
def add(
    id: str,
    body: Symbol,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = owned(db, user, id)
    asset = asset_or_404(db, body.symbol)
    if not db.get(WatchlistAsset, (id, asset.symbol)):
        db.add(WatchlistAsset(watchlist_id=id, symbol=asset.symbol))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return view(db, row)


@router.delete("/{id}/assets/{symbol}", status_code=204)
def discard(
    id: str,
    symbol: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned(db, user, id)
    db.execute(
        delete(WatchlistAsset).where(
            WatchlistAsset.watchlist_id == id, WatchlistAsset.symbol == symbol.upper()
        )
    )
    db.commit()


@router.get("/{id}/quotes")
def quotes(id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = owned(db, user, id)
    return [
        overview(db, asset_or_404(db, symbol)) for symbol in view(db, row)["symbols"]
    ]

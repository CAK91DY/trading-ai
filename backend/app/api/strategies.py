from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import Strategy, User, AuditLog
from app.schemas.strategy import StrategyBody

router = APIRouter(prefix="/api/strategies", tags=["Stratégies"])


def owned(db, user, id):
    row = db.scalar(
        select(Strategy).where(Strategy.id == id, Strategy.user_id == user.id)
    )
    if not row:
        raise HTTPException(404, "Stratégie introuvable.")
    return row


def view(row):
    return {
        k: getattr(row, k) for k in ["id", "name", "active", "definition", "created_at"]
    }


def audit(db, user, event, id):
    db.add(AuditLog(user_id=user.id, event=event, details={"id": id}))


@router.get("")
def lists(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [
        view(r)
        for r in db.scalars(
            select(Strategy)
            .where(Strategy.user_id == user.id)
            .order_by(Strategy.created_at.desc())
        )
    ]


@router.post("", status_code=201)
def create(
    body: StrategyBody,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    count = db.scalar(
        select(func.count()).select_from(Strategy).where(Strategy.user_id == user.id)
    )
    if count >= 100:
        raise HTTPException(422, "Maximum 100 stratégies.")
    row = Strategy(user_id=user.id, **body.model_dump())
    db.add(row)
    db.flush()
    audit(db, user, "strategy.create", row.id)
    db.commit()
    return view(row)


@router.patch("/{id}")
def update(
    id: str,
    body: StrategyBody,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = owned(db, user, id)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    audit(db, user, "strategy.update", id)
    db.commit()
    return view(row)


@router.delete("/{id}", status_code=204)
def remove(id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = owned(db, user, id)
    db.delete(row)
    audit(db, user, "strategy.delete", id)
    db.commit()

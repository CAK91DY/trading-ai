import hashlib
import secrets
import time
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User, AuthSession, AuthAttempt

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))
COOKIE = "trading_session"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    session = db.get(AuthSession, digest(token)) if token else None
    if not session or session.expires_at <= time.time():
        raise HTTPException(401, "Connectez-vous pour continuer.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Session invalide.")
    return user


def open_session(db, response: Response, user, old_token=None):
    if old_token:
        db.execute(
            delete(AuthSession).where(AuthSession.token_hash == digest(old_token))
        )
    token = secrets.token_urlsafe(48)
    db.add(
        AuthSession(
            token_hash=digest(token),
            user_id=user.id,
            expires_at=time.time() + settings.session_hours * 3600,
        )
    )
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )


def throttle(db, request, action, limit=12):
    # Persistent limits; proxy headers deliberately not trusted.
    key = digest(f"{action}:{request.client.host if request.client else 'unknown'}")
    row = db.scalar(select(AuthAttempt).where(AuthAttempt.key == key).with_for_update())
    now = time.time()
    if row and now - row.window_start < 900:
        if row.count >= limit:
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.")
        row.count += 1
    elif row:
        row.window_start = now
        row.count = 1
    else:
        db.add(AuthAttempt(key=key, count=1, window_start=now))
    db.commit()

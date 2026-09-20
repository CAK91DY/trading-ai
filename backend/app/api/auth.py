import secrets
import time
from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    current_user,
    passwords,
    DUMMY_HASH,
    digest,
    open_session,
    throttle,
    COOKIE,
)
from app.models.entities import User, AuthSession, PasswordReset, AuditLog
from app.schemas.auth import Login, Register, Profile, Forgot, Reset
from app.services.mail import send_reset

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


def public(user):
    return {"id": user.id, "email": user.email, "name": user.name}


@router.post("/register", status_code=201)
def register(
    body: Register, request: Request, response: Response, db: Session = Depends(get_db)
):
    throttle(db, request, "register", 10)
    user = User(
        email=body.email, name=body.name, password_hash=passwords.hash(body.password)
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Inscription impossible avec cette adresse. Essayez de vous connecter."
        )
    open_session(db, response, user, request.cookies.get(COOKIE))
    db.add(AuditLog(user_id=user.id, event="auth.register"))
    db.commit()
    return public(user)


@router.post("/login")
def login(
    body: Login, request: Request, response: Response, db: Session = Depends(get_db)
):
    throttle(db, request, "login")
    user = db.scalar(select(User).where(User.email == body.email))
    valid = passwords.verify(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Adresse ou mot de passe incorrect.")
    open_session(db, response, user, request.cookies.get(COOKIE))
    db.add(AuditLog(user_id=user.id, event="auth.login"))
    db.commit()
    return public(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public(user)


@router.patch("/me")
def profile(
    body: Profile, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    user.name = body.name
    db.add(AuditLog(user_id=user.id, event="auth.profile"))
    db.commit()
    return public(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(token)))
    db.commit()
    response.delete_cookie(COOKIE, path="/")


@router.post("/forgot-password")
def forgot(body: Forgot, request: Request, db: Session = Depends(get_db)):
    throttle(db, request, "forgot", 5)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user:
        token = secrets.token_urlsafe(48)
        db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
        db.add(
            PasswordReset(
                token_hash=digest(token), user_id=user.id, expires_at=time.time() + 1800
            )
        )
        try:
            send_reset(user.email, token)
        except Exception:
            db.rollback()
            # Same response regardless of existence/delivery to prevent enumeration.
            return {
                "message": "Si cette adresse est inscrite, un lien de récupération sera envoyé."
            }
        db.add(AuditLog(user_id=user.id, event="auth.reset_requested"))
        db.commit()
    return {
        "message": "Si cette adresse est inscrite, un lien de récupération sera envoyé."
    }


@router.post("/reset-password")
def reset(body: Reset, request: Request, db: Session = Depends(get_db)):
    throttle(db, request, "reset")
    reset = db.scalar(
        select(PasswordReset)
        .where(PasswordReset.token_hash == digest(body.token))
        .with_for_update()
    )
    if not reset or reset.expires_at < time.time():
        raise HTTPException(400, "Lien invalide ou expiré.")
    user = db.get(User, reset.user_id)
    user.password_hash = passwords.hash(body.password)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    db.add(AuditLog(user_id=user.id, event="auth.password_reset"))
    db.commit()
    return {"message": "Mot de passe modifié. Connectez-vous à nouveau."}

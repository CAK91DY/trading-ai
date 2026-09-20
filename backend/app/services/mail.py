from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4
import os
import smtplib
from app.core.config import settings


def send_reset(email: str, token: str):
    msg = EmailMessage()
    msg["Subject"] = "Trading AI — Réinitialiser votre mot de passe"
    msg["From"] = settings.smtp_from
    msg["To"] = email
    msg.set_content(
        f"Lien valable 30 minutes, utilisable une seule fois :\n{settings.frontend_url}/reset-password#token={token}\nIgnorez ce message si vous n’avez rien demandé."
    )
    if settings.mail_mode == "file":
        # Development only: not served through HTTP, no token in API responses/logs.
        path = Path(settings.work_dir) / "mail"
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        target = path / f"{uuid4()}.eml"
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write(msg.as_string())
    elif settings.mail_mode == "smtp" and settings.smtp_host:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    else:
        raise RuntimeError("Configurez SMTP pour envoyer les e-mails.")

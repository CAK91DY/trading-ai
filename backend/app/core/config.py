from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT.parent / ".env", extra="ignore")
    database_url: str = "sqlite:///./trading.db"
    frontend_url: str = "http://127.0.0.1:5173"
    secure_cookies: bool = False
    session_hours: int = 24
    mail_mode: str = "file"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Trading AI <noreply@localhost>"
    smtp_tls: bool = True
    data_cache_minutes: int = 15
    work_dir: Path = ROOT.parent / "work"


settings = Settings()

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.core.config import settings
from app.core.database import SessionLocal
from app.api import auth, markets, watchlists, backtests
from app.market_data.catalog import seed


@asynccontextmanager
async def lifespan(app):
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(title="Trading AI", version="0.2.0", lifespan=lifespan)
origins = list(
    set([settings.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"])
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def protect_writes(request: Request, call_next):
    if request.method in {"POST", "PATCH", "DELETE", "PUT"}:
        if request.headers.get("x-requested-with") != "TradingAI":
            return JSONResponse(
                {"detail": "En-tête de protection CSRF absent."}, status_code=403
            )
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse({"detail": "Origine non autorisée."}, status_code=403)
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 2_100_000:
            return JSONResponse(
                {"detail": "Requête trop volumineuse."}, status_code=413
            )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    with SessionLocal() as db:
        db.execute(select(1))
    return {"status": "ok", "mode": "simulation", "version": "0.2.0"}


app.include_router(auth.router)
app.include_router(markets.router)
app.include_router(watchlists.router)
app.include_router(backtests.router)

from app.api import settings as settings_api

app.include_router(settings_api.router)

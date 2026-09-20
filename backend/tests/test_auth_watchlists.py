import time
from sqlalchemy import select
from app.models.entities import User, AuthSession
from app.api import auth
from app.core.security import passwords


def test_auth_lifecycle_csrf(client, factory):
    assert client.get("/api/watchlists").status_code == 401
    body = {
        "name": "Alice",
        "email": "Alice@EXAMPLE.com",
        "password": "A-testing-password-123",
    }
    assert (
        client.post(
            "/api/auth/register", json=body, headers={"X-Requested-With": ""}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/register", json=body, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 201
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert client.get("/api/auth/me").json()["email"] == "alice@example.com"
    with factory() as db:
        user = db.scalar(select(User))
        assert user.password_hash.startswith("$argon2")
        assert passwords.verify(body["password"], user.password_hash)
    assert (
        client.patch("/api/auth/me", json={"name": "Alice B"}).json()["name"]
        == "Alice B"
    )
    token = client.cookies.get("trading_session")
    assert client.post("/api/auth/logout").status_code == 204
    assert (
        client.get(
            "/api/auth/me", headers={"Cookie": f"trading_session={token}"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": body["email"], "password": "wrong"}
        ).status_code
        == 401
    )
    assert client.post("/api/auth/login", json=body).status_code == 200
    with factory() as db:
        row = db.scalar(select(AuthSession))
        row.expires_at = time.time() - 1
        db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_watchlist_crud_and_account_isolation(client, account):
    first = client.post("/api/watchlists", json={"name": "Tech"}).json()
    id = first["id"]
    assert client.post(f"/api/watchlists/{id}/assets", json={"symbol": "AAPL"}).json()[
        "symbols"
    ] == ["AAPL"]
    assert client.post(f"/api/watchlists/{id}/assets", json={"symbol": "AAPL"}).json()[
        "symbols"
    ] == ["AAPL"]
    assert (
        client.patch(f"/api/watchlists/{id}", json={"name": "Tech US"}).json()["name"]
        == "Tech US"
    )
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": "Another-testing-password",
        },
    )
    assert client.get("/api/watchlists").json() == []
    assert client.delete(f"/api/watchlists/{id}").status_code == 404
    assert (
        client.post(f"/api/watchlists/{id}/assets", json={"symbol": "MSFT"}).status_code
        == 404
    )
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "A-testing-password-123"},
    )
    assert client.delete(f"/api/watchlists/{id}/assets/AAPL").status_code == 204
    assert client.get("/api/watchlists").json()[0]["symbols"] == []
    assert client.delete(f"/api/watchlists/{id}").status_code == 204
    assert client.get("/api/watchlists").json() == []


def test_reset_single_use_and_revocation(client, account, monkeypatch):
    sent = []
    monkeypatch.setattr(auth, "send_reset", lambda email, token: sent.append(token))
    unknown = client.post(
        "/api/auth/forgot-password", json={"email": "unknown@example.com"}
    )
    known = client.post(
        "/api/auth/forgot-password", json={"email": "alice@example.com"}
    )
    assert unknown.json() == known.json()
    assert "token" not in known.text
    token = sent[0]
    assert (
        client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "new-secure-password-123"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "other-new-password-123"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "A-testing-password-123"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "new-secure-password-123"},
        ).status_code
        == 200
    )


def test_login_throttled(client):
    for _ in range(12):
        assert (
            client.post(
                "/api/auth/login",
                json={"email": "missing@example.com", "password": "wrong"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "missing@example.com", "password": "wrong"},
        ).status_code
        == 429
    )


def test_backtest_private(client, account):
    csv = "date,open,close\n" + "\n".join(
        f"2026-01-{i + 1:02d},{10 + i},{10 + i}" for i in range(8)
    )
    result = client.post("/api/backtests", json={"csv": csv, "fast": 2, "slow": 3})
    assert result.status_code == 201, result.text
    assert client.get("/api/backtests").json()[0]["id"] == result.json()["id"]
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": "Another-testing-password",
        },
    )
    assert client.get("/api/backtests").json() == []

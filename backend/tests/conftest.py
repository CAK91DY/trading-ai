import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.core.database import Base, get_db
from app.api import main


@pytest.fixture
def factory(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False}
    )
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def fk(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(main, "SessionLocal", factory)

    def override():
        with factory() as db:
            yield db

    main.app.dependency_overrides[get_db] = override
    yield factory
    main.app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def client(factory):
    with TestClient(
        main.app,
        headers={"X-Requested-With": "TradingAI", "Origin": "http://127.0.0.1:5173"},
    ) as client:
        yield client


@pytest.fixture
def account(client):
    body = {
        "name": "Alice",
        "email": "alice@example.com",
        "password": "A-testing-password-123",
    }
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 201, response.text
    return response.json()

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import Project


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(Project(name="Sec"))
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    session.close()


def test_cors_allows_configured_origin(client):
    response = client.options(
        "/api/health",
        headers={
            "Origin": settings.cors_origin_list()[0],
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == settings.cors_origin_list()[0]


def test_require_user_name_blocks_anonymous_writes(client, monkeypatch):
    monkeypatch.setattr(settings, "require_user_name", True)
    response = client.post("/api/projects", json={"name": "Без имени"})
    assert response.status_code == 401

    named = client.post(
        "/api/projects",
        json={"name": "С именем"},
        headers={"X-User-Name": "Tester"},
    )
    assert named.status_code == 201

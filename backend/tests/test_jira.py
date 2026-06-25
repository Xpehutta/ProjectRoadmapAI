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
def client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()
    session.close()


def test_jira_status_not_configured(client, monkeypatch):
    test_client, _session = client
    monkeypatch.setattr(settings, "jira_url", None)
    monkeypatch.setattr(settings, "jira_email", None)
    monkeypatch.setattr(settings, "jira_api_token", None)
    monkeypatch.setattr(settings, "jira_project_key", None)

    response = test_client.get("/api/jira/status")
    assert response.status_code == 200
    assert response.json() == {"configured": False, "project_key": None}


def test_jira_status_configured(client, monkeypatch):
    test_client, _session = client
    monkeypatch.setattr(settings, "jira_url", "https://example.atlassian.net")
    monkeypatch.setattr(settings, "jira_email", "user@example.com")
    monkeypatch.setattr(settings, "jira_api_token", "token")
    monkeypatch.setattr(settings, "jira_project_key", "ROAD")

    response = test_client.get("/api/jira/status")
    assert response.status_code == 200
    assert response.json() == {"configured": True, "project_key": "ROAD"}


def test_create_project_without_jira_epic(client):
    test_client, session = client
    response = test_client.post(
        "/api/projects",
        json={"name": "Новый проект", "description": "Описание"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Новый проект"
    assert body["jira_epic_key"] is None

    project = session.query(Project).one()
    assert project.jira_epic_key is None


def test_create_project_with_jira_epic(client, monkeypatch):
    test_client, session = client
    monkeypatch.setattr(settings, "jira_url", "https://example.atlassian.net")
    monkeypatch.setattr(settings, "jira_email", "user@example.com")
    monkeypatch.setattr(settings, "jira_api_token", "token")
    monkeypatch.setattr(settings, "jira_project_key", "ROAD")

    async def fake_create_epic(name: str, description: str | None = None):
        assert name == "Новый проект"
        assert description == "Описание"
        return {"key": "ROAD-42", "url": "https://example.atlassian.net/browse/ROAD-42"}

    monkeypatch.setattr("app.routers.projects.create_epic", fake_create_epic)

    response = test_client.post(
        "/api/projects",
        json={"name": "Новый проект", "description": "Описание", "create_jira_epic": True},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["jira_epic_key"] == "ROAD-42"
    assert body["jira_epic_url"] == "https://example.atlassian.net/browse/ROAD-42"

    project = session.query(Project).one()
    assert project.jira_epic_key == "ROAD-42"

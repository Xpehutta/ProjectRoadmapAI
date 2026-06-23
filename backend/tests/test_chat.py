import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Task
from app.services.project_context import build_project_context, format_project_context


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
    project = Project(name="Витрины", description="Тестовый проект")
    session.add(project)
    session.flush()
    session.add(
        Task(
            project_id=project.id,
            name="Витрина продаж",
            status="in_progress",
            completion_pct=40,
            planned_cost=150000.50,
        )
    )
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session, project
    app.dependency_overrides.clear()
    session.close()


def test_build_project_context(client):
    _, _, project = client
    ctx = build_project_context(client[1], project.id)
    assert ctx["project"]["name"] == "Витрины"
    assert len(ctx["tasks"]) == 1
    assert ctx["tasks"][0]["name"] == "Витрина продаж"
    assert ctx["tasks"][0]["planned_cost"] == 150000.5
    text = format_project_context(ctx)
    parsed = json.loads(text)
    assert parsed["tasks"][0]["status"] == "in_progress"


def test_chat_status_not_configured(client, monkeypatch):
    test_client, _, project = client
    monkeypatch.setattr("app.routers.chat.is_agent_configured", lambda: False)
    response = test_client.get(f"/api/projects/{project.id}/chat/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["model"] is None


def test_chat_returns_503_without_credentials(client, monkeypatch):
    test_client, _, project = client
    monkeypatch.setattr("app.services.project_agent.is_agent_configured", lambda: True)

    def fake_chat(*_args, **_kwargs):
        from app.services.project_agent import ProjectAgentNotConfigured

        raise ProjectAgentNotConfigured("no creds")

    monkeypatch.setattr("app.routers.chat.chat", fake_chat)
    response = test_client.post(
        f"/api/projects/{project.id}/chat",
        json={"messages": [{"role": "user", "content": "Сколько задач?"}]},
    )
    assert response.status_code == 503


def test_chat_success_with_mock(client, monkeypatch):
    test_client, _, project = client
    monkeypatch.setattr("app.services.project_agent.is_agent_configured", lambda: True)
    monkeypatch.setattr("app.routers.chat.chat", lambda _ctx, _msgs: "В проекте 1 задача.")
    response = test_client.post(
        f"/api/projects/{project.id}/chat",
        json={"messages": [{"role": "user", "content": "Сколько задач?"}]},
    )
    assert response.status_code == 200
    assert "1 задача" in response.json()["reply"]


def test_system_prompt_includes_context_without_format_error():
    from app.services.project_agent import _system_content

    context = json.dumps({"tasks": [{"id": 42, "name": "Тест"}]}, ensure_ascii=False)
    content = _system_content(context)
    assert context in content
    assert "sub_stage:{id}" in content


def test_chat_project_not_found(client):
    test_client, _, _ = client
    response = test_client.post(
        "/api/projects/9999/chat",
        json={"messages": [{"role": "user", "content": "Привет"}]},
    )
    assert response.status_code == 404

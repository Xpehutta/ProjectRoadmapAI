"""Tests for shared component creation and task linking."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Task, TaskSubStage


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
    project = Project(name="Test")
    session.add(project)
    session.flush()
    task_a = Task(project_id=project.id, name="Витрина A", data_source="Система X")
    task_b = Task(project_id=project.id, name="Витрина B", data_source="Система X")
    session.add_all([task_a, task_b])
    session.flush()
    session.add(
        TaskSubStage(
            task_id=task_a.id,
            name="Этап 1",
            sort_order=0,
            is_done=False,
            is_indicative=True,
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
        yield test_client, session, project, task_a, task_b
    app.dependency_overrides.clear()
    session.close()


def test_promote_task_creates_shared_component(client):
    test_client, session, project, task_a, task_b = client
    response = test_client.post(f"/api/tasks/{task_a.id}/promote-to-component")
    assert response.status_code == 200
    body = response.json()
    assert body["data_source"] == "Система X"
    assert len(body["sub_stages"]) == 1

    session.refresh(task_a)
    assert task_a.component_id == body["id"]
    assert session.query(TaskSubStage).filter(TaskSubStage.task_id == task_a.id).count() == 0

    link = test_client.post(f"/api/tasks/{task_b.id}/link-component/{body['id']}")
    assert link.status_code == 200
    session.refresh(task_b)
    assert task_b.component_id == body["id"]
    listed = test_client.get(f"/api/projects/{project.id}/components").json()
    assert listed[0]["usage_count"] == 2


def test_component_stage_shift_visible_in_context_for_all_usages(client):
    from app.services.project_context import build_project_context

    test_client, session, project, task_a, task_b = client
    promote = test_client.post(f"/api/tasks/{task_a.id}/promote-to-component")
    component_id = promote.json()["id"]
    test_client.post(f"/api/tasks/{task_b.id}/link-component/{component_id}")

    stage_id = promote.json()["sub_stages"][0]["id"]
    test_client.patch(
        f"/api/tasks/{task_a.id}/sub-stages/{stage_id}",
        json={"end_date": "2024-05-15"},
    )

    ctx = build_project_context(session, project.id)
    for task_id in (task_a.id, task_b.id):
        task_ctx = next(t for t in ctx["tasks"] if t["id"] == task_id)
        shifts = task_ctx.get("stage_shifts", [])
        assert len(shifts) == 1
        assert shifts[0]["stage_name"] == "Этап 1"


def test_create_component_and_link(client):
    test_client, session, project, task_a, _task_b = client
    created = test_client.post(
        f"/api/projects/{project.id}/components",
        json={"name": "Источник Y", "data_source": "Источник Y"},
    )
    assert created.status_code == 201
    component_id = created.json()["id"]

    linked = test_client.post(f"/api/tasks/{task_a.id}/link-component/{component_id}")
    assert linked.status_code == 200
    session.refresh(task_a)
    assert task_a.component_id == component_id
    assert task_a.data_source == "Источник Y"

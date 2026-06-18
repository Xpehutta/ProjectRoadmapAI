from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Task, TaskStatus


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
    project = Project(name="Sub-stages Test")
    session.add(project)
    session.flush()
    task = Task(
        project_id=project.id,
        name="Task with stages",
        status=TaskStatus.todo,
        component_id=None,
    )
    session.add(task)
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session, task
    app.dependency_overrides.clear()
    session.close()


def test_create_sub_stage_with_start_and_end_dates(client):
    test_client, _session, task = client
    response = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={
            "name": "Разработка",
            "sort_order": 0,
            "start_date": "2024-03-01",
            "end_date": "2024-03-15",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["start_date"] == "2024-03-01"
    assert body["end_date"] == "2024-03-15"
    assert body["due_date"] == "2024-03-15"


def test_update_sub_stage_end_syncs_due_date(client):
    test_client, _session, task = client
    create = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={"name": "Тест", "sort_order": 0},
    )
    stage_id = create.json()["id"]
    response = test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{stage_id}",
        json={"end_date": "2024-04-10"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["end_date"] == "2024-04-10"
    assert body["due_date"] == "2024-04-10"


def test_indicative_dates_recomputed_from_stages(client):
    test_client, session, task = client
    test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={
            "name": "Этап 1",
            "sort_order": 0,
            "start_date": "2024-03-01",
            "end_date": "2024-03-10",
        },
    )
    test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={
            "name": "Этап 2",
            "sort_order": 1,
            "start_date": "2024-03-15",
            "end_date": "2024-03-25",
        },
    )
    session.expire_all()
    session.refresh(task)
    assert task.indicative_start == date(2024, 3, 1)
    assert task.indicative_end == date(2024, 3, 25)

    stages = test_client.get(f"/api/tasks/{task.id}/sub-stages").json()
    stage2_id = next(s["id"] for s in stages if s["name"] == "Этап 2")
    test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{stage2_id}",
        json={"end_date": "2024-04-05"},
    )
    session.expire_all()
    session.refresh(task)
    assert task.indicative_start == date(2024, 3, 1)
    assert task.indicative_end == date(2024, 4, 5)


def test_patch_start_date_on_second_stage(client):
    test_client, session, task = client
    first = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={"name": "Этап 1", "sort_order": 0},
    ).json()
    second = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={"name": "Этап 2", "sort_order": 1},
    ).json()

    response = test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{second['id']}",
        json={"start_date": "2024-05-10"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["start_date"] == "2024-05-10"

    session.expire_all()
    from app.models import TaskSubStage

    stage1 = session.get(TaskSubStage, first["id"])
    assert stage1.end_date is None

    test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{first['id']}",
        json={"end_date": "2024-05-09"},
    )
    session.expire_all()
    stage1 = session.get(TaskSubStage, first["id"])
    assert stage1.end_date == date(2024, 5, 9)
    assert stage1.due_date == date(2024, 5, 9)


def test_actual_dates_set_when_stage_marked_done(client):
    test_client, session, task = client
    stage = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={
            "name": "Разработка",
            "sort_order": 0,
            "start_date": "2024-03-01",
            "end_date": "2024-03-15",
        },
    ).json()
    test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{stage['id']}",
        json={"is_done": True},
    )
    session.expire_all()
    session.refresh(task)
    assert task.start_date == date(2024, 3, 1)
    assert task.end_date == date(2024, 3, 15)
    assert task.duration_days == 15


def test_sub_stage_predecessor_ids(client):
    test_client, session, task = client
    first = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={"name": "Этап 1", "sort_order": 0},
    ).json()
    second = test_client.post(
        f"/api/tasks/{task.id}/sub-stages",
        json={"name": "Этап 2", "sort_order": 1},
    ).json()
    response = test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{second['id']}",
        json={"predecessor_stage_ids": [first["id"]]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["predecessor_stage_ids"] == [first["id"]]

    bad = test_client.patch(
        f"/api/tasks/{task.id}/sub-stages/{second['id']}",
        json={"predecessor_stage_ids": [99999]},
    )
    assert bad.status_code == 400

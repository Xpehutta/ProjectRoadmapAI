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
    project = Project(name="Dates Test")
    session.add(project)
    session.flush()
    task = Task(
        project_id=project.id,
        name="Standalone task",
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


def test_patch_dates_on_task_without_component(client):
    test_client, session, task = client
    response = test_client.patch(
        f"/api/tasks/{task.id}",
        json={
            "version": task.version,
            "start_date": "2024-03-01",
            "end_date": "2024-03-15",
            "indicative_start": "2024-02-01",
            "indicative_end": "2024-02-28",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["task"]["start_date"] == "2024-03-01"
    assert body["task"]["end_date"] == "2024-03-15"
    assert body["task"]["indicative_start"] == "2024-02-01"
    assert body["task"]["indicative_end"] == "2024-02-28"

    session.refresh(task)
    assert task.start_date == date(2024, 3, 1)
    assert task.end_date == date(2024, 3, 15)
    assert task.indicative_start == date(2024, 2, 1)
    assert task.indicative_end == date(2024, 2, 28)

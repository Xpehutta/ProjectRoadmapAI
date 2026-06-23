import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import NotificationSubscription, Project, Task


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
    project = Project(name="Уведомления")
    session.add(project)
    session.flush()
    session.add(Task(project_id=project.id, name="Задача 1"))
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


def test_subscribe_and_unsubscribe(client):
    test_client, session, project = client
    email = "user@example.com"

    status = test_client.get(
        f"/api/projects/{project.id}/notifications/status",
        params={"email": email},
    )
    assert status.status_code == 200
    assert status.json()["subscribed"] is False

    sub = test_client.post(
        f"/api/projects/{project.id}/notifications/subscribe",
        json={"email": email},
        headers={"X-User-Name": "Ivan"},
    )
    assert sub.status_code == 200
    assert sub.json()["subscribed"] is True

    row = session.query(NotificationSubscription).one()
    assert row.email == email
    assert row.display_name == "Ivan"

    unsub = test_client.delete(
        f"/api/projects/{project.id}/notifications/subscribe",
        params={"email": email},
    )
    assert unsub.status_code == 200
    assert unsub.json()["subscribed"] is False
    assert session.query(NotificationSubscription).count() == 0


def test_log_change_queues_notification_on_commit(client, monkeypatch):
    from app.models import AuditEventType
    from app.services.audit import log_change

    _, session, project = client
    task = session.query(Task).filter(Task.project_id == project.id).first()
    delivered: list = []

    monkeypatch.setattr(
        "app.services.notifications._deliver_in_background",
        lambda pending: delivered.extend(pending),
    )

    log_change(session, task, AuditEventType.dates, "end_date", "2026-01-01", "2026-01-15")
    session.commit()

    assert len(delivered) == 1
    assert delivered[0].task_id == task.id
    assert delivered[0].field == "end_date"

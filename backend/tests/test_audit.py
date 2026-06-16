from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.context import user_name_var
from app.database import Base
from app.models import AuditEvent, AuditEventType, Project, ProjectComponent, Task, TaskStatus
from app.services.audit import _serialize, log_change
from app.services.scheduling import apply_field_changes


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    project = Project(name="Test", created_at=__import__("datetime").datetime.utcnow())
    session.add(project)
    session.flush()
    task = Task(
        project_id=project.id,
        name="A",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 10),
        duration_days=10,
        created_at=__import__("datetime").datetime.utcnow(),
        updated_at=__import__("datetime").datetime.utcnow(),
    )
    session.add(task)
    session.commit()
    yield session
    session.close()


def test_audit_log_append_only(db):
    token = user_name_var.set("Tester")
    try:
        task = db.query(Task).one()
        log_change(db, task, AuditEventType.dates, "end_date", "2026-01-10", "2026-01-15")
        db.commit()
        events = db.query(AuditEvent).all()
        assert len(events) == 1
        assert events[0].user_name == "Tester"
        assert events[0].field == "end_date"
        assert events[0].old_value == "2026-01-10"
        assert events[0].new_value == "2026-01-15"
    finally:
        user_name_var.reset(token)


def test_audit_skips_unchanged(db):
    task = db.query(Task).one()
    result = log_change(db, task, AuditEventType.dates, "end_date", "2026-01-10", "2026-01-10")
    assert result is None


def test_serialize_task_status_enum():
    assert _serialize(TaskStatus.todo) == "todo"
    assert _serialize(TaskStatus.blocked) == "blocked"


def test_component_changes_audit_against_task(db):
    project = db.query(Project).one()
    component = ProjectComponent(
        project_id=project.id,
        name="ППРБ.РКО ФИ",
        data_source="ППРБ.РКО ФИ",
        status=TaskStatus.todo,
        completion_pct=0,
        version=1,
        created_at=__import__("datetime").datetime.utcnow(),
        updated_at=__import__("datetime").datetime.utcnow(),
    )
    db.add(component)
    db.flush()
    task = db.query(Task).one()
    task.component_id = component.id
    db.commit()

    apply_field_changes(
        db,
        component,
        {"status": TaskStatus.blocked},
        audit_task=task,
    )
    db.commit()

    event = db.query(AuditEvent).one()
    assert event.task_id == task.id
    assert event.field == "status"
    assert event.old_value == "todo"
    assert event.new_value == "blocked"
    assert component.status == TaskStatus.blocked

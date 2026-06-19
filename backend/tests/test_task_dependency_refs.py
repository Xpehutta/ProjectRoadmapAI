"""Tests for stage-aware task dependency references."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import pytest

from app.database import Base
from app.models import DependencyType, Project, Task, TaskSubStage
from app.services.task_dependency_refs import parse_predecessor_ref, resolve_predecessor_refs


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_parse_predecessor_ref_formats():
    assert parse_predecessor_ref("Task A") == ("Task A", None, None, DependencyType.FS)
    assert parse_predecessor_ref("Task A:2") == ("Task A", 2, None, DependencyType.FS)
    assert parse_predecessor_ref("Task A>3") == ("Task A", None, 3, DependencyType.FS)
    assert parse_predecessor_ref("Task A:2>3") == ("Task A", 2, 3, DependencyType.FS)
    assert parse_predecessor_ref("Task A:2>3@SS") == ("Task A", 2, 3, DependencyType.SS)


def test_resolve_predecessor_refs_with_stages(db):
    project = Project(name="P")
    db.add(project)
    db.flush()

    pred = Task(project_id=project.id, name="Alpha")
    succ = Task(project_id=project.id, name="Beta")
    db.add_all([pred, succ])
    db.flush()

    db.add_all(
        [
            TaskSubStage(task_id=pred.id, name="A1", sort_order=0),
            TaskSubStage(task_id=pred.id, name="A2", sort_order=1),
            TaskSubStage(task_id=succ.id, name="B1", sort_order=0),
            TaskSubStage(task_id=succ.id, name="B2", sort_order=1),
            TaskSubStage(task_id=succ.id, name="B3", sort_order=2),
        ]
    )
    db.commit()
    db.refresh(pred)
    db.refresh(succ)

    pred_stages = sorted(pred.sub_stages, key=lambda s: s.sort_order)
    succ_stages = sorted(succ.sub_stages, key=lambda s: s.sort_order)

    resolved = resolve_predecessor_refs(db, project.id, ["Alpha:2>3"], succ)
    assert len(resolved) == 1
    assert resolved[0].task.id == pred.id
    assert resolved[0].predecessor_stage_id == pred_stages[1].id
    assert resolved[0].successor_stage_id == succ_stages[2].id

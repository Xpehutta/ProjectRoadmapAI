from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Dependency, DependencyType, Project, Task
from app.services.scheduling import cascade_from_task, detect_cycle


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    project = Project(name="Test", created_at=__import__("datetime").datetime.utcnow())
    session.add(project)
    session.flush()
    t1 = Task(
        project_id=project.id,
        name="A",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 10),
        duration_days=10,
        created_at=__import__("datetime").datetime.utcnow(),
        updated_at=__import__("datetime").datetime.utcnow(),
    )
    t2 = Task(
        project_id=project.id,
        name="B",
        start_date=date(2026, 1, 11),
        end_date=date(2026, 1, 20),
        duration_days=10,
        created_at=__import__("datetime").datetime.utcnow(),
        updated_at=__import__("datetime").datetime.utcnow(),
    )
    session.add_all([t1, t2])
    session.flush()
    session.add(
        Dependency(
            project_id=project.id,
            predecessor_id=t1.id,
            successor_id=t2.id,
            type=DependencyType.FS,
        )
    )
    session.commit()
    yield session
    session.close()


def test_cascade_shifts_successor(db):
    t1 = db.query(Task).filter(Task.name == "A").one()
    t2 = db.query(Task).filter(Task.name == "B").one()
    t1.end_date = date(2026, 1, 15)
    t1.duration_days = 15
    affected = cascade_from_task(db, t1)
    db.commit()
    db.refresh(t2)
    assert len(affected) == 1
    assert t2.start_date == date(2026, 1, 16)


def test_detect_cycle_self(db):
    t1 = db.query(Task).filter(Task.name == "A").one()
    assert detect_cycle(db, t1.project_id, t1.id, t1.id)


def test_detect_cycle_simple(db):
    t1 = db.query(Task).filter(Task.name == "A").one()
    t2 = db.query(Task).filter(Task.name == "B").one()
    assert detect_cycle(db, t1.project_id, t2.id, t1.id)

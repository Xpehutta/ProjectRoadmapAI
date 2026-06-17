import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Project, Task
from app.services.flexible_import import (
    build_column_specs,
    import_flexible_json,
    import_flexible_sheet,
    is_datamarts_headers,
    map_header_to_field,
)
from app.services.project_import import import_project_from_upload


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


def test_map_header_aliases():
    assert map_header_to_field("Task Name") == "name"
    assert map_header_to_field("Статус") == "status"
    assert map_header_to_field("Random Column") is None


def test_is_datamarts_headers():
    assert is_datamarts_headers(["БВ", "Источник", "Субпродукт"])
    assert not is_datamarts_headers(["Task", "Owner", "Deadline"])


def test_build_column_specs_from_free_headers():
    rows = [{"Widget": "Alpha", "Owner": "Ann", "Q1 Target": "100"}]
    specs = build_column_specs(["Widget", "Owner", "Q1 Target"], rows)
    keys = [s.key for s in specs]
    assert "status" in keys
    assert any(s.source == "custom" for s in specs)


def test_import_flexible_sheet(db):
    headers = ["Task", "Status", "Category", "Start", "End", "Vendor"]
    raw_rows = [
        ["Build API", "В работе", "Backend", "2026-01-01", "2026-01-15", "Acme"],
        ["Design UI", "Не начато", "Frontend", "2026-02-01", "2026-02-10", "Beta LLC"],
    ]
    project = import_flexible_sheet(
        db,
        headers=headers,
        raw_rows=raw_rows,
        project_name="Freeform",
    )
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    assert len(tasks) == 2
    assert project.table_schema
    assert len(project.table_schema) >= 4
    assert tasks[0].custom_fields
    assert "Acme" in tasks[0].custom_fields.values()


def test_import_flexible_json(db):
    payload = {
        "format": "flexible",
        "name": "JSON Project",
        "rows": [
            {"Title": "Item 1", "Team": "Ops", "ETA": "2026-03-01"},
            {"Title": "Item 2", "Team": "Dev", "ETA": "2026-04-01"},
        ],
    }
    project = import_flexible_json(db, payload, "JSON Project")
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    assert len(tasks) == 2
    assert project.table_schema


def test_upload_routes_to_flexible_for_unknown_columns(db):
    csv_like = "Task,Owner,Deadline\nAlpha,Ann,2026-05-01\n"
    # xlsx path tested elsewhere; use JSON list for freeform
    content = json.dumps(
        [{"Title": "One", "Department": "IT"}, {"Title": "Two", "Department": "HR"}]
    ).encode("utf-8")
    project = import_project_from_upload(
        db,
        content=content,
        filename="teams.json",
        project_name="Teams",
    )
    assert db.query(Task).filter(Task.project_id == project.id).count() == 2
    assert project.table_schema

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.datamarts_import import resolve_xlsx_path
from app.main import app
from app.models import Task
from app.services.project_import import import_project_from_upload, name_from_filename


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


def test_name_from_filename():
    assert name_from_filename("Roadmap Q3.xlsx") == "Roadmap Q3"
    assert name_from_filename("data.xls") == "data"


def test_import_project_from_xlsx_bytes(client):
    _, db = client
    path = resolve_xlsx_path()
    content = path.read_bytes()
    project = import_project_from_upload(
        db,
        content=content,
        filename="upload.xlsx",
        project_name="Uploaded Marts",
    )
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    assert project.name == "Uploaded Marts"
    assert len(tasks) >= 50


def test_import_project_from_json_rows(client):
    _, db = client
    payload = [
        {
            "category": "Категория A",
            "name": "Задача 1",
            "data_source": "SRC-1",
            "status": "todo",
            "start_date": "2026-01-01",
            "end_date": "2026-01-10",
        },
        {
            "category": "Категория A",
            "name": "Задача 2",
            "data_source": "SRC-2",
            "status": "in_progress",
        },
    ]
    project = import_project_from_upload(
        db,
        content=json.dumps(payload).encode("utf-8"),
        filename="roadmap.json",
    )
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    assert project.name == "roadmap"
    assert len(tasks) == 2


def test_import_project_api(client):
    test_client, _ = client
    path = resolve_xlsx_path()
    content = path.read_bytes()
    response = test_client.post(
        "/api/projects/import",
        files={
            "file": (
                "DataMarts.xlsx",
                content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        data={"name": "API Import"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "API Import"


def test_import_project_rejects_unknown_extension(client):
    test_client, _ = client
    response = test_client.post(
        "/api/projects/import",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400

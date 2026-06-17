import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project, Task, TaskStatus
from app.services.table_schema import default_table_schema, materialize_schema, pinned_keys_for_project


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


def test_default_generic_schema_includes_indicative_dates():
    keys = {col["key"] for col in default_table_schema("generic")}
    assert keys == {
        "status",
        "name",
        "assignee",
        "start_date",
        "end_date",
        "indicative_start",
        "indicative_end",
        "completion_pct",
    }


def test_default_datamarts_schema():
    keys = {col["key"] for col in default_table_schema("datamarts")}
    assert "category_id" in keys
    assert "data_source" in keys
    assert "indicative_end" in keys


def test_materialize_adaptive_uses_pinned_columns(db):
    project = Project(name="Roadmap")
    db.add(project)
    db.commit()
    schema = materialize_schema(project, [])
    keys = {col["key"] for col in schema}
    assert "assignee" in keys
    assert "indicative_start" in keys


def test_materialize_datamarts_by_project_name(db):
    project = Project(name="Витрины данных")
    db.add(project)
    db.commit()
    pinned = pinned_keys_for_project(project, [])
    assert "data_source" in pinned
    schema = materialize_schema(project, [])
    assert any(col["key"] == "subproduct" for col in schema)


@pytest.fixture
def client(db):
    session = db
    project = Project(name="Columns Test")
    session.add(project)
    session.flush()
    task = Task(
        project_id=project.id,
        name="Task A",
        status=TaskStatus.todo,
        custom_fields={"custom_vendor": "Acme"},
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
        yield test_client, session, project, task
    app.dependency_overrides.clear()
    session.close()


def test_create_project_has_default_schema(client):
    test_client, session, _project, _task = client
    response = test_client.post("/api/projects", json={"name": "Fresh"})
    assert response.status_code == 201
    project_id = response.json()["id"]
    project = session.query(Project).filter(Project.id == project_id).one()
    assert project.table_schema
    keys = {col["key"] for col in project.table_schema}
    assert "indicative_start" in keys
    assert "assignee" in keys


def test_list_table_columns_materializes_adaptive(client):
    test_client, _session, project, _task = client
    response = test_client.get(f"/api/projects/{project.id}/table-columns")
    assert response.status_code == 200
    body = response.json()
    keys = [c["key"] for c in body["columns"]]
    assert "status" in keys
    assert "name" in keys
    assert "custom_vendor" in keys
    assert any(c["key"] == "customer" for c in body["hidden_builtin"])


def test_add_custom_column(client):
    test_client, session, project, _task = client
    response = test_client.post(
        f"/api/projects/{project.id}/table-columns",
        json={"label": "Бюджет Q2"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "custom"
    assert body["label"] == "Бюджет Q2"

    session.refresh(project)
    assert project.table_schema
    assert any(c["label"] == "Бюджет Q2" for c in project.table_schema)


def test_add_builtin_column(client):
    test_client, session, project, _task = client
    response = test_client.post(
        f"/api/projects/{project.id}/table-columns",
        json={"builtin_key": "customer"},
    )
    assert response.status_code == 201
    assert response.json()["key"] == "customer"

    session.refresh(project)
    assert any(c["key"] == "customer" for c in project.table_schema)


def test_remove_custom_column_clears_task_data(client):
    test_client, session, project, task = client
    test_client.post(f"/api/projects/{project.id}/table-columns", json={"label": "Vendor"})
    session.refresh(project)

    custom_key = next(
        c["key"]
        for c in project.table_schema
        if c.get("source") == "custom" and c["key"] != "custom_vendor"
    )
    response = test_client.delete(f"/api/projects/{project.id}/table-columns/{custom_key}")
    assert response.status_code == 204

    session.refresh(task)
    assert custom_key not in (task.custom_fields or {})


def test_cannot_remove_core_columns(client):
    test_client, _session, project, _task = client
    response = test_client.delete(f"/api/projects/{project.id}/table-columns/status")
    assert response.status_code == 400

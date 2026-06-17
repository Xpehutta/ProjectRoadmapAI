import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Project
from app.services.stage_templates import load_predefined_templates


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


def test_predefined_templates_loaded():
    templates = load_predefined_templates()
    assert len(templates) >= 10
    assert any("Детальный слой" in t["full_label"] for t in templates)


def test_project_stage_templates_api(client):
    test_client, _, project = client
    response = test_client.get(f"/api/projects/{project.id}/stage-templates")
    assert response.status_code == 200
    body = response.json()
    assert len(body["predefined"]) >= 10
    assert body["custom"] == []


def test_add_custom_stage_template(client):
    test_client, session, project = client
    response = test_client.post(
        f"/api/projects/{project.id}/stage-templates",
        json={"name": "UAT testing", "full_label": "UAT testing"},
    )
    assert response.status_code == 201
    session.refresh(project)
    assert len(project.stage_templates) == 1

    listed = test_client.get(f"/api/projects/{project.id}/stage-templates").json()
    assert any(t["full_label"] == "UAT testing" for t in listed["custom"])

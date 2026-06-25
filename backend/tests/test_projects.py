import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Category, Project, Task


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
    project = Project(name="Удаляемый")
    session.add(project)
    session.flush()
    session.add(Category(project_id=project.id, name="Категория", sort_order=0))
    session.add(Task(project_id=project.id, name="Задача"))
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


def test_delete_project(client):
    test_client, session, project = client
    project_id = project.id

    response = test_client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 204

    assert session.query(Project).filter(Project.id == project_id).first() is None
    assert session.query(Task).filter(Task.project_id == project_id).count() == 0
    assert session.query(Category).filter(Category.project_id == project_id).count() == 0


def test_delete_project_not_found(client):
    test_client, _session, project = client
    response = test_client.delete(f"/api/projects/{project.id + 9999}")
    assert response.status_code == 404

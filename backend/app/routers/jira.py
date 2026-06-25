import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.schemas import JiraEpicCreate, JiraEpicOut, JiraStatusResponse
from app.services.jira import JiraError, create_epic, jira_configured

router = APIRouter(prefix="/jira", tags=["jira"])
logger = logging.getLogger(__name__)


@router.get("/status", response_model=JiraStatusResponse)
def jira_status():
    return JiraStatusResponse(
        configured=jira_configured(),
        project_key=settings_project_key(),
    )


def settings_project_key() -> str | None:
    from app.config import settings

    return settings.jira_project_key if jira_configured() else None


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.post("/projects/{project_id}/epic", response_model=JiraEpicOut)
async def create_project_epic(
    project_id: int,
    payload: JiraEpicCreate,
    db: Session = Depends(get_db),
):
    if not jira_configured():
        raise HTTPException(503, "Интеграция с Jira не настроена")

    project = _get_project(db, project_id)
    if project.jira_epic_key:
        raise HTTPException(
            409,
            f"У проекта уже есть Epic в Jira: {project.jira_epic_key}",
        )

    name = (payload.name or project.name).strip()
    description = payload.description if payload.description is not None else project.description
    if not name:
        raise HTTPException(400, "Название Epic обязательно")

    try:
        epic = await create_epic(name, description)
    except JiraError as exc:
        status = exc.status_code if exc.status_code and exc.status_code < 500 else 502
        if exc.status_code and exc.status_code >= 500:
            status = 502
        raise HTTPException(status, str(exc)) from exc

    project.jira_epic_key = epic["key"]
    project.jira_epic_url = epic["url"]
    db.commit()
    db.refresh(project)
    return JiraEpicOut(key=epic["key"], url=epic["url"])

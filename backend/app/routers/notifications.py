from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.context import user_name_var
from app.database import get_db
from app.models import NotificationSubscription, Project
from app.schemas import NotificationStatusResponse, NotificationSubscribe
from app.services.notifications import notifications_configured

router = APIRouter(prefix="/projects", tags=["notifications"])


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/{project_id}/notifications/status", response_model=NotificationStatusResponse)
def notification_status(
    project_id: int,
    email: str = Query(..., min_length=3, max_length=255),
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    sub = (
        db.query(NotificationSubscription)
        .filter(
            NotificationSubscription.project_id == project_id,
            NotificationSubscription.email == email.strip().lower(),
        )
        .first()
    )
    return NotificationStatusResponse(
        subscribed=sub is not None,
        email=email.strip().lower(),
        notifications_configured=notifications_configured(),
    )


@router.post("/{project_id}/notifications/subscribe", response_model=NotificationStatusResponse)
def subscribe_notifications(
    project_id: int,
    payload: NotificationSubscribe,
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Некорректный адрес email")

    sub = (
        db.query(NotificationSubscription)
        .filter(
            NotificationSubscription.project_id == project_id,
            NotificationSubscription.email == email,
        )
        .first()
    )
    if not sub:
        sub = NotificationSubscription(
            project_id=project_id,
            email=email,
            display_name=user_name_var.get() or None,
        )
        db.add(sub)
        db.commit()
    return NotificationStatusResponse(
        subscribed=True,
        email=email,
        notifications_configured=notifications_configured(),
    )


@router.delete("/{project_id}/notifications/subscribe", response_model=NotificationStatusResponse)
def unsubscribe_notifications(
    project_id: int,
    email: str = Query(..., min_length=3, max_length=255),
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    normalized = email.strip().lower()
    sub = (
        db.query(NotificationSubscription)
        .filter(
            NotificationSubscription.project_id == project_id,
            NotificationSubscription.email == normalized,
        )
        .first()
    )
    if sub:
        db.delete(sub)
        db.commit()
    return NotificationStatusResponse(
        subscribed=False,
        email=normalized,
        notifications_configured=notifications_configured(),
    )

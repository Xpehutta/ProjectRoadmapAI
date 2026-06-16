from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.context import user_name_var
from app.database import get_db
from app.models import AuditEvent, AuditEventType, Comment, Task
from app.schemas import AuditEventOut, CommentCreate, CommentOut
from app.services.audit import log_change

router = APIRouter(tags=["comments", "history"])


@router.get("/tasks/{task_id}/comments", response_model=list[CommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Comment)
        .filter(Comment.task_id == task_id)
        .order_by(Comment.created_at.desc())
        .all()
    )


@router.post("/tasks/{task_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(task_id: int, payload: CommentCreate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    comment = Comment(task_id=task_id, user_name=user_name_var.get(), body=payload.body)
    db.add(comment)
    log_change(db, task, AuditEventType.comment, "comment", None, payload.body[:200])
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/tasks/{task_id}/history", response_model=list[AuditEventOut])
def task_history(
    task_id: int,
    event_type: AuditEventType | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditEvent).filter(AuditEvent.task_id == task_id)
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    return q.order_by(AuditEvent.created_at.desc()).all()


@router.get("/projects/{project_id}/audit", response_model=list[AuditEventOut])
def project_audit(
    project_id: int,
    event_type: AuditEventType | None = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(AuditEvent)
        .join(Task, Task.id == AuditEvent.task_id)
        .filter(Task.project_id == project_id)
    )
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    return q.order_by(AuditEvent.created_at.desc()).limit(500).all()

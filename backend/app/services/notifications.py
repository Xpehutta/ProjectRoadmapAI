"""Email-уведомления подписчикам проекта об изменениях задач."""

from __future__ import annotations

import logging
import smtplib
import threading
from collections.abc import Callable
from dataclasses import dataclass
from email.message import EmailMessage

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import NotificationSubscription, Project
from app.services.notification_batch import PendingTaskChange, take_pending_changes

logger = logging.getLogger(__name__)

_delivery_fn: Callable[[list[PendingTaskChange]], None] | None = None

_FIELD_LABELS: dict[str, str] = {
    "start_date": "дата начала",
    "end_date": "дата окончания",
    "indicative_start": "индикативное начало",
    "indicative_end": "индикативное окончание",
    "duration_days": "длительность (дни)",
    "status": "статус",
    "completion_pct": "% выполнения",
    "planned_cost": "плановая стоимость",
    "actual_cost": "фактическая стоимость",
    "planned_effort": "плановые трудозатраты",
    "actual_effort": "фактические трудозатраты",
    "assignee": "исполнитель",
    "comment": "комментарий",
}

_EVENT_LABELS: dict[str, str] = {
    "dates": "сроки",
    "cost": "стоимость",
    "effort": "трудозатраты",
    "status": "статус",
    "comment": "комментарий",
    "other": "изменение",
}


def notifications_configured() -> bool:
    return bool(
        settings.notifications_enabled
        and settings.smtp_host
        and settings.notification_from_email
    )


def _field_label(field: str) -> str:
    if field.startswith("sub_stage:"):
        parts = field.split(":", 2)
        if len(parts) >= 3:
            stage_part = parts[2]
            if "." in stage_part:
                stage_name, date_field = stage_part.rsplit(".", 1)
                date_label = _FIELD_LABELS.get(date_field, date_field)
                return f"этап «{stage_name}» ({date_label})"
        return field
    return _FIELD_LABELS.get(field, field)


@dataclass(frozen=True)
class EmailJob:
    to_email: str
    project_id: int
    project_name: str
    actor: str
    changes: tuple[PendingTaskChange, ...]


def _build_email_jobs(db: Session, pending: list[PendingTaskChange]) -> list[EmailJob]:
    if not pending:
        return []

    by_project: dict[int, list[PendingTaskChange]] = {}
    for change in pending:
        by_project.setdefault(change.project_id, []).append(change)

    jobs: list[EmailJob] = []
    for project_id, changes in by_project.items():
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            continue
        subscribers = (
            db.query(NotificationSubscription)
            .filter(NotificationSubscription.project_id == project_id)
            .all()
        )
        if not subscribers:
            continue

        actor = changes[-1].actor
        for sub in subscribers:
            if sub.display_name and sub.display_name == actor:
                continue
            jobs.append(
                EmailJob(
                    to_email=sub.email,
                    project_id=project_id,
                    project_name=project.name,
                    actor=actor,
                    changes=tuple(changes),
                )
            )
    return jobs


def _format_change_line(change: PendingTaskChange) -> str:
    label = _field_label(change.field)
    event = _EVENT_LABELS.get(change.event_type, change.event_type)
    old_v = change.old_value if change.old_value is not None else "—"
    new_v = change.new_value if change.new_value is not None else "—"
    return f"  • {change.task_name} (#{change.task_id}), {event}: {label}: {old_v} → {new_v}"


def _compose_message(job: EmailJob) -> EmailMessage:
    lines = "\n".join(_format_change_line(c) for c in job.changes)
    body = (
        f"Изменения в проекте «{job.project_name}»\n"
        f"Автор: {job.actor}\n"
        f"Приложение: {settings.app_base_url}\n\n"
        f"{lines}\n"
    )
    subject = f"[Дорожная карта] Изменения в проекте «{job.project_name}»"
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.notification_from_email
    msg["To"] = job.to_email
    msg.set_content(body, charset="utf-8")
    return msg


def _send_smtp(message: EmailMessage) -> None:
    if not settings.smtp_host or not settings.notification_from_email:
        raise RuntimeError("SMTP не настроен")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


def deliver_notifications(pending: list[PendingTaskChange]) -> None:
    if not pending or not notifications_configured():
        return

    db = SessionLocal()
    try:
        jobs = _build_email_jobs(db, pending)
        for job in jobs:
            try:
                _send_smtp(_compose_message(job))
                logger.info("Notification sent to %s for project %s", job.to_email, job.project_id)
            except Exception:
                logger.exception("Failed to send notification to %s", job.to_email)
    finally:
        db.close()


def _deliver_in_background(pending: list[PendingTaskChange]) -> None:
    if not pending:
        return
    if _delivery_fn is not None:
        _delivery_fn(pending)
        return
    if not notifications_configured():
        return
    thread = threading.Thread(target=deliver_notifications, args=(pending,), daemon=True)
    thread.start()


def set_delivery_fn(fn: Callable[[list[PendingTaskChange]], None] | None) -> None:
    global _delivery_fn
    _delivery_fn = fn


def reset_delivery_fn() -> None:
    set_delivery_fn(None)


@event.listens_for(Session, "after_commit")
def _on_session_commit(session: Session) -> None:
    pending = take_pending_changes(session)
    if pending:
        _deliver_in_background(pending)

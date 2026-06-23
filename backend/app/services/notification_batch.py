"""Накопление изменений в session.info до успешного commit."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session


@dataclass(frozen=True)
class PendingTaskChange:
    task_id: int
    project_id: int
    task_name: str
    field: str
    old_value: str | None
    new_value: str | None
    actor: str
    event_type: str


_SESSION_KEY = "pending_notifications"


def queue_task_change(session: Session, change: PendingTaskChange) -> None:
    bucket: list[PendingTaskChange] = session.info.setdefault(_SESSION_KEY, [])
    bucket.append(change)


def take_pending_changes(session: Session) -> list[PendingTaskChange]:
    pending = session.info.pop(_SESSION_KEY, [])
    return list(pending)

"""Аудит изменений дат этапов задачи."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AuditEventType, Task
from app.services.audit import log_change

_STAGE_DATE_FIELDS = ("start_date", "end_date", "due_date")


def log_stage_date_changes(
    db: Session,
    task: Task,
    stage,
    updates: dict,
) -> None:
    """Записать в журнал сдвиг дат этапа до применения updates к stage."""
    stage_name = getattr(stage, "name", "") or f"stage_{stage.id}"
    for field in _STAGE_DATE_FIELDS:
        if field not in updates:
            continue
        old_value = getattr(stage, field)
        new_value = updates[field]
        if old_value == new_value:
            continue
        log_change(
            db,
            task,
            AuditEventType.dates,
            f"sub_stage:{stage.id}:{stage_name}.{field}",
            old_value,
            new_value,
        )

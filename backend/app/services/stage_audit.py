"""Аудит изменений дат этапов задачи."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent, AuditEventType, Task
from app.services.audit import log_change

_STAGE_DATE_FIELDS = ("start_date", "end_date")
_STAGE_SHIFT_FIELD_RE = re.compile(r"^sub_stage:(\d+):(.+)\.(start_date|end_date)$")
TASK_DATE_SHIFT_FIELDS = frozenset({"start_date", "end_date", "indicative_start", "indicative_end"})
_SHIFT_COMMENT_MARKERS = (
    "этап «",
    "запланирован этап «",
    "скорректирован",
    "перенос",
    "сдвиг",
)


def is_shift_comment(text: str) -> bool:
    lower = (text or "").lower()
    return any(marker in lower for marker in _SHIFT_COMMENT_MARKERS)


def _attach_shift_days(entry: dict[str, Any], old_value: str | None, new_value: str | None) -> dict[str, Any]:
    days = stage_shift_days(old_value, new_value)
    if days is not None:
        entry["days"] = days
        entry["days_abs"] = abs(days)
        if days > 0:
            entry["direction"] = "later"
        elif days < 0:
            entry["direction"] = "earlier"
        else:
            entry["direction"] = "unchanged"
    return entry


def parse_stage_shift_field(field: str) -> tuple[int, str, str] | None:
    """Разбор поля журнала `sub_stage:{id}:{имя}.{start_date|end_date}`."""
    match = _STAGE_SHIFT_FIELD_RE.match(field or "")
    if not match:
        return None
    return int(match.group(1)), match.group(2), match.group(3)


def stage_shift_days(old_value: str | None, new_value: str | None) -> int | None:
    """Разница в календарных днях (new − old); положительное = сдвиг позже."""
    if not old_value or not new_value:
        return None
    try:
        old_date = date.fromisoformat(old_value)
        new_date = date.fromisoformat(new_value)
    except ValueError:
        return None
    return (new_date - old_date).days


def stage_shift_from_event(event: AuditEvent) -> dict[str, Any] | None:
    parsed = parse_stage_shift_field(event.field or "")
    if not parsed:
        return None
    stage_id, stage_name, date_field = parsed
    entry: dict[str, Any] = {
        "at": event.created_at.isoformat(),
        "user": event.user_name,
        "stage_id": stage_id,
        "stage_name": stage_name,
        "date_field": date_field,
        "old": event.old_value,
        "new": event.new_value,
    }
    return _attach_shift_days(entry, event.old_value, event.new_value)


def task_date_shift_from_event(event: AuditEvent) -> dict[str, Any] | None:
    field = event.field or ""
    if field not in TASK_DATE_SHIFT_FIELDS:
        return None
    entry: dict[str, Any] = {
        "at": event.created_at.isoformat(),
        "user": event.user_name,
        "field": field,
        "old": event.old_value,
        "new": event.new_value,
    }
    return _attach_shift_days(entry, event.old_value, event.new_value)


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

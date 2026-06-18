"""Validate sub-stage predecessor references within the same task or component."""

from __future__ import annotations

from fastapi import HTTPException

from app.models import ComponentSubStage, TaskSubStage


def _normalize_ids(raw: list[int] | None) -> list[int]:
    if not raw:
        return []
    seen: set[int] = set()
    out: list[int] = []
    for item in raw:
        if not isinstance(item, int) or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def validate_predecessor_stage_ids(
    stage_id: int | None,
    predecessor_ids: list[int] | None,
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> list[int]:
    cleaned = _normalize_ids(predecessor_ids)
    valid_ids = {s.id for s in stages}
    invalid = [pid for pid in cleaned if pid not in valid_ids]
    if invalid:
        raise HTTPException(400, f"Unknown predecessor stage ids: {invalid}")
    if stage_id is not None:
        cleaned = [pid for pid in cleaned if pid != stage_id]
    return cleaned

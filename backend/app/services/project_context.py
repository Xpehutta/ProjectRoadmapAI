"""Сбор компактного контекста проекта для ИИ-ассистента."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models import AuditEvent, AuditEventType, Category, Comment, Dependency, Goal, Milestone, Project, ProjectComponent, Release, Task
from app.models import Dependency as DepModel
from app.services.components import component_to_out, load_component
from app.services.stage_audit import (
    is_shift_comment,
    stage_shift_from_event,
    task_date_shift_from_event,
)
from app.services.tasks import task_to_out


def _drop_none(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if v is not None and v != [] and v != {}}


MAX_COMMENTS_PER_TASK = 15
MAX_HISTORY_PER_TASK = 25
MAX_STAGE_SHIFTS_PER_TASK = 40
MAX_DATE_SHIFTS_PER_TASK = 40


def _shift_targets(
    event_task_id: int,
    *,
    task_component_map: dict[int, int | None],
    component_to_task_ids: dict[int, list[int]],
) -> list[int]:
    component_id = task_component_map.get(event_task_id)
    if component_id:
        return component_to_task_ids.get(component_id, [event_task_id])
    return [event_task_id]


def _append_shift_entry(
    buckets: dict[int, list[dict[str, Any]]],
    seen: dict[int, set[tuple[Any, ...]]],
    *,
    task_ids: list[int],
    targets: list[int],
    entry: dict[str, Any],
    dedupe_key: tuple[Any, ...],
    limit: int,
) -> None:
    for task_id in targets:
        if task_id not in buckets:
            continue
        if dedupe_key in seen[task_id]:
            continue
        if len(buckets[task_id]) >= limit:
            continue
        seen[task_id].add(dedupe_key)
        buckets[task_id].append(entry)


def _load_task_shifts(
    db: Session,
    task_ids: list[int],
    *,
    task_component_map: dict[int, int | None],
    component_to_task_ids: dict[int, list[int]],
) -> tuple[dict[int, list[dict[str, Any]]], dict[int, list[dict[str, Any]]]]:
    if not task_ids:
        return {}, {}

    stage_shifts_by_task: dict[int, list[dict[str, Any]]] = {tid: [] for tid in task_ids}
    date_shifts_by_task: dict[int, list[dict[str, Any]]] = {tid: [] for tid in task_ids}
    stage_seen: dict[int, set[tuple[Any, ...]]] = {tid: set() for tid in task_ids}
    date_seen: dict[int, set[tuple[Any, ...]]] = {tid: set() for tid in task_ids}
    for event in (
        db.query(AuditEvent)
        .filter(
            AuditEvent.task_id.in_(task_ids),
            AuditEvent.event_type == AuditEventType.dates,
        )
        .order_by(AuditEvent.created_at.desc())
        .all()
    ):
        targets = _shift_targets(
            event.task_id,
            task_component_map=task_component_map,
            component_to_task_ids=component_to_task_ids,
        )
        stage_entry = stage_shift_from_event(event)
        if stage_entry:
            dedupe_key = (
                stage_entry["at"],
                stage_entry["stage_id"],
                stage_entry["date_field"],
                stage_entry.get("old"),
                stage_entry.get("new"),
            )
            _append_shift_entry(
                stage_shifts_by_task,
                stage_seen,
                task_ids=task_ids,
                targets=targets,
                entry=stage_entry,
                dedupe_key=dedupe_key,
                limit=MAX_STAGE_SHIFTS_PER_TASK,
            )
            continue

        date_entry = task_date_shift_from_event(event)
        if not date_entry:
            continue
        dedupe_key = (
            date_entry["at"],
            date_entry["field"],
            date_entry.get("old"),
            date_entry.get("new"),
        )
        _append_shift_entry(
            date_shifts_by_task,
            date_seen,
            task_ids=task_ids,
            targets=targets,
            entry=date_entry,
            dedupe_key=dedupe_key,
            limit=MAX_DATE_SHIFTS_PER_TASK,
        )
    return stage_shifts_by_task, date_shifts_by_task


def _shift_comments(comments: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
    if not comments:
        return None
    filtered = [c for c in comments if is_shift_comment(c.get("text", ""))]
    return filtered or None


def _build_project_shifts_summary(task_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    recent: list[dict[str, Any]] = []
    stage_count = 0
    task_date_count = 0
    comment_count = 0

    for task in task_summaries:
        task_id = task["id"]
        task_name = task["name"]
        for entry in task.get("stage_shifts") or []:
            stage_count += 1
            recent.append({"kind": "stage", "task_id": task_id, "task_name": task_name, **entry})
        for entry in task.get("date_shifts") or []:
            task_date_count += 1
            recent.append({"kind": "task_date", "task_id": task_id, "task_name": task_name, **entry})
        for entry in task.get("shift_comments") or []:
            comment_count += 1
            recent.append({"kind": "comment", "task_id": task_id, "task_name": task_name, **entry})

    total = stage_count + task_date_count + comment_count
    if total == 0:
        return {"any": False, "total": 0}

    recent.sort(key=lambda item: item.get("at") or "", reverse=True)
    return _drop_none(
        {
            "any": True,
            "total": total,
            "stage_shift_count": stage_count or None,
            "task_date_shift_count": task_date_count or None,
            "shift_comment_count": comment_count or None,
            "recent": recent[:30],
        }
    )


def _comment_entry(comment: Comment) -> dict[str, Any]:
    return {
        "at": comment.created_at.isoformat(),
        "user": comment.user_name,
        "text": comment.body,
    }


def _history_entry(event: AuditEvent) -> dict[str, Any]:
    return _drop_none(
        {
            "at": event.created_at.isoformat(),
            "user": event.user_name,
            "type": event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type),
            "field": event.field,
            "old": event.old_value,
            "new": event.new_value,
        }
    )


def _load_task_activity(
    db: Session, task_ids: list[int]
) -> tuple[dict[int, list[dict[str, Any]]], dict[int, list[dict[str, Any]]]]:
    if not task_ids:
        return {}, {}

    comments_by_task: dict[int, list[dict[str, Any]]] = {tid: [] for tid in task_ids}
    for comment in (
        db.query(Comment)
        .filter(Comment.task_id.in_(task_ids))
        .order_by(Comment.created_at.desc())
        .all()
    ):
        bucket = comments_by_task.setdefault(comment.task_id, [])
        if len(bucket) < MAX_COMMENTS_PER_TASK:
            bucket.append(_comment_entry(comment))

    history_by_task: dict[int, list[dict[str, Any]]] = {tid: [] for tid in task_ids}
    for event in (
        db.query(AuditEvent)
        .filter(AuditEvent.task_id.in_(task_ids))
        .order_by(AuditEvent.created_at.desc())
        .all()
    ):
        bucket = history_by_task.setdefault(event.task_id, [])
        if len(bucket) < MAX_HISTORY_PER_TASK:
            bucket.append(_history_entry(event))

    return comments_by_task, history_by_task


def _task_summary(
    task_out,
    *,
    comments: list[dict[str, Any]] | None = None,
    history: list[dict[str, Any]] | None = None,
    stage_shifts: list[dict[str, Any]] | None = None,
    date_shifts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    stages = [
        _drop_none(
            {
                "id": s.id,
                "name": s.name,
                "start": str(s.start_date) if s.start_date else None,
                "end": str(s.end_date) if s.end_date else None,
                "done": s.is_done,
                "indicative": s.is_indicative,
            }
        )
        for s in task_out.sub_stages
    ]
    preds = [
        _drop_none(
            {
                "task": p.name,
                "type": p.type.value if hasattr(p.type, "value") else str(p.type),
                "from_stage": p.predecessor_stage_number,
                "to_stage": p.successor_stage_number,
            }
        )
        for p in task_out.predecessors
    ]
    shift_comments = _shift_comments(comments)
    return _drop_none(
        {
            "id": task_out.id,
            "name": task_out.name,
            "status": task_out.status.value if hasattr(task_out.status, "value") else str(task_out.status),
            "completion_pct": task_out.completion_pct,
            "category_id": task_out.category_id,
            "assignee": task_out.assignee,
            "start": str(task_out.start_date) if task_out.start_date else None,
            "end": str(task_out.end_date) if task_out.end_date else None,
            "indicative_start": str(task_out.indicative_start) if task_out.indicative_start else None,
            "indicative_end": str(task_out.indicative_end) if task_out.indicative_end else None,
            "subproduct": task_out.subproduct,
            "data_source": task_out.data_source,
            "customer": task_out.customer,
            "platform": task_out.platform,
            "area": task_out.area,
            "contractor": task_out.contractor,
            "release_id": task_out.release_id,
            "goal_id": task_out.goal_id,
            "component": task_out.component_name,
            "planned_cost": float(task_out.planned_cost) if task_out.planned_cost is not None else None,
            "actual_cost": float(task_out.actual_cost) if task_out.actual_cost is not None else None,
            "planned_effort": float(task_out.planned_effort) if task_out.planned_effort is not None else None,
            "actual_effort": float(task_out.actual_effort) if task_out.actual_effort is not None else None,
            "moscow": task_out.moscow.value if task_out.moscow and hasattr(task_out.moscow, "value") else task_out.moscow,
            "stages": stages or None,
            "predecessors": preds or None,
            "notes": task_out.notes,
            "risks": task_out.risks,
            "custom_fields": task_out.custom_fields or None,
            "comments": comments or None,
            "shift_comments": shift_comments,
            "history": history or None,
            "stage_shifts": stage_shifts or None,
            "date_shifts": date_shifts or None,
        }
    )


def build_project_context(db: Session, project_id: int) -> dict[str, Any]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {}

    categories = db.query(Category).filter(Category.project_id == project_id).order_by(Category.sort_order).all()
    components = (
        db.query(ProjectComponent)
        .filter(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.name)
        .all()
    )
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.tasks),
            joinedload(Task.predecessors).joinedload(DepModel.predecessor),
        )
        .filter(Task.project_id == project_id)
        .all()
    )
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.date).all()
    releases = db.query(Release).filter(Release.project_id == project_id).order_by(Release.sort_order).all()
    goals = db.query(Goal).filter(Goal.project_id == project_id).order_by(Goal.sort_order).all()

    category_map = {c.id: c.name for c in categories}
    task_outs = [task_to_out(t) for t in tasks]
    task_ids = [t.id for t in tasks]
    task_component_map = {t.id: t.component_id for t in tasks}
    component_to_task_ids: dict[int, list[int]] = {}
    for t in tasks:
        if t.component_id:
            component_to_task_ids.setdefault(t.component_id, []).append(t.id)

    comments_by_task, history_by_task = _load_task_activity(db, task_ids)
    stage_shifts_by_task, date_shifts_by_task = _load_task_shifts(
        db,
        task_ids,
        task_component_map=task_component_map,
        component_to_task_ids=component_to_task_ids,
    )

    task_summaries = []
    for t in task_outs:
        task_comments = comments_by_task.get(t.id) or None
        summary = _task_summary(
            t,
            comments=task_comments,
            history=history_by_task.get(t.id) or None,
            stage_shifts=stage_shifts_by_task.get(t.id) or None,
            date_shifts=date_shifts_by_task.get(t.id) or None,
        )
        cid = summary.get("category_id")
        if cid and cid in category_map:
            summary["category"] = category_map[cid]
        task_summaries.append(summary)

    shifts_summary = _build_project_shifts_summary(task_summaries)

    return _drop_none(
        {
            "project": _drop_none(
                {
                    "id": project.id,
                    "name": project.name,
                    "description": project.description,
                    "task_count": len(task_outs),
                }
            ),
            "categories": [{"id": c.id, "name": c.name, "color": c.color} for c in categories] or None,
            "releases": [
                _drop_none(
                    {
                        "id": r.id,
                        "name": r.name,
                        "target_date": str(r.target_date) if r.target_date else None,
                        "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                    }
                )
                for r in releases
            ]
            or None,
            "goals": [{"id": g.id, "name": g.name, "description": g.description} for g in goals] or None,
            "milestones": [
                _drop_none({"id": m.id, "name": m.name, "date": str(m.date), "description": m.description})
                for m in milestones
            ]
            or None,
            "components": [
                _drop_none(
                    {
                        "id": c.id,
                        "name": c.name,
                        "data_source": c.data_source,
                        "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                        "completion_pct": c.completion_pct,
                        "usage_count": len(c.usages) if hasattr(c, "usages") else 0,
                    }
                )
                for c in (component_to_out(load_component(db, comp.id) or comp) for comp in components)
            ]
            or None,
            "shifts": shifts_summary,
            "tasks": task_summaries,
        }
    )


def format_project_context(context: dict[str, Any]) -> str:
    return json.dumps(context, ensure_ascii=False, separators=(",", ":"))

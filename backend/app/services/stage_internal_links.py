"""Typed internal stage dependencies (До / После) within one task or component."""

from __future__ import annotations

from typing import Literal

from fastapi import HTTPException

from app.models import ComponentSubStage, Task, TaskSubStage

StageLinkRelation = Literal["after", "before"]


def _normalize_link(raw: dict) -> dict | None:
    try:
        first = int(raw["first_stage_id"])
        second = int(raw["second_stage_id"])
        relation = raw["relation"]
    except (KeyError, TypeError, ValueError):
        return None
    if first == second:
        return None
    if relation not in ("after", "before"):
        return None
    return {"first_stage_id": first, "second_stage_id": second, "relation": relation}


def normalize_internal_stage_links(raw: list | None) -> list[dict]:
    if not raw:
        return []
    out: list[dict] = []
    seen: set[tuple[int, int, str]] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        link = _normalize_link(item)
        if not link:
            continue
        key = (link["first_stage_id"], link["second_stage_id"], link["relation"])
        if key in seen:
            continue
        seen.add(key)
        out.append(link)
    return out


def pred_succ_from_link(link: dict) -> tuple[int, int]:
    """Map UI link (first, second, relation) to stored predecessor/successor."""
    first = link["first_stage_id"]
    second = link["second_stage_id"]
    if link["relation"] == "after":
        return first, second
    return second, first


def link_key(pred_id: int, succ_id: int) -> tuple[int, int]:
    return pred_id, succ_id


def links_from_predecessors(
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> list[dict]:
    """Build default 'after' links from legacy predecessor_stage_ids only."""
    links: list[dict] = []
    seen: set[tuple[int, int, str]] = set()
    for succ in stages:
        for pred_id in succ.predecessor_stage_ids or []:
            key = (pred_id, succ.id, "after")
            if key in seen:
                continue
            seen.add(key)
            links.append(
                {
                    "first_stage_id": pred_id,
                    "second_stage_id": succ.id,
                    "relation": "after",
                }
            )
    return links


def sync_predecessors_from_links(
    stages: list[TaskSubStage] | list[ComponentSubStage],
    links: list[dict],
) -> None:
    valid_ids = {s.id for s in stages}
    preds_by_succ: dict[int, list[int]] = {s.id: [] for s in stages}
    for link in links:
        pred, succ = pred_succ_from_link(link)
        if pred not in valid_ids or succ not in valid_ids or pred == succ:
            raise HTTPException(400, "Invalid internal stage link")
        preds = preds_by_succ.setdefault(succ, [])
        if pred not in preds:
            preds.append(pred)
    for stage in stages:
        stage.predecessor_stage_ids = preds_by_succ.get(stage.id, [])


def validate_internal_stage_links(
    links: list[dict] | None,
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> list[dict]:
    cleaned = normalize_internal_stage_links(links)
    valid_ids = {s.id for s in stages}
    for link in cleaned:
        first = link["first_stage_id"]
        second = link["second_stage_id"]
        if first not in valid_ids or second not in valid_ids:
            raise HTTPException(400, "Unknown stage id in internal stage link")
        pred, succ = pred_succ_from_link(link)
        if pred not in valid_ids or succ not in valid_ids:
            raise HTTPException(400, "Invalid internal stage link")
    return cleaned


def strip_links_for_stage(links: list[dict], stage_id: int) -> list[dict]:
    return [
        link
        for link in links
        if link["first_stage_id"] != stage_id and link["second_stage_id"] != stage_id
    ]


def effective_internal_stage_links(
    task: Task,
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> list[dict]:
    if task.component_id and task.component:
        raw = task.component.internal_stage_links
    else:
        raw = task.internal_stage_links
    links = normalize_internal_stage_links(raw)
    if links:
        return links
    return links_from_predecessors(stages)


def set_internal_stage_links(
    task: Task,
    links: list[dict],
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> list[dict]:
    cleaned = validate_internal_stage_links(links, stages)
    sync_predecessors_from_links(stages, cleaned)
    if task.component_id and task.component:
        task.component.internal_stage_links = cleaned
    else:
        task.internal_stage_links = cleaned
    return cleaned


def replace_successor_after_links(
    existing: list[dict],
    succ_stage_id: int,
    pred_stage_ids: list[int],
) -> list[dict]:
    """Replace «После» links where the given stage is the second (dependent) one."""
    kept = [
        link
        for link in existing
        if not (link["relation"] == "after" and link["second_stage_id"] == succ_stage_id)
    ]
    for pred_id in pred_stage_ids:
        kept.append(
            {
                "first_stage_id": pred_id,
                "second_stage_id": succ_stage_id,
                "relation": "after",
            }
        )
    return normalize_internal_stage_links(kept)


def remove_link(existing: list[dict], pred_id: int, succ_id: int) -> list[dict]:
    return [
        link
        for link in existing
        if pred_succ_from_link(link) != (pred_id, succ_id)
    ]


def add_link(
    existing: list[dict],
    first_stage_id: int,
    second_stage_id: int,
    relation: StageLinkRelation,
) -> list[dict]:
    pred, succ = pred_succ_from_link(
        {"first_stage_id": first_stage_id, "second_stage_id": second_stage_id, "relation": relation}
    )
    if any(pred_succ_from_link(link) == (pred, succ) for link in existing):
        raise HTTPException(400, "Duplicate internal stage link")
    return normalize_internal_stage_links(
        [
            *existing,
            {
                "first_stage_id": first_stage_id,
                "second_stage_id": second_stage_id,
                "relation": relation,
            },
        ]
    )

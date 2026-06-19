from sqlalchemy.orm import Session

from app.models import ComponentSubStage, Task, TaskStatus, TaskSubStage
from app.services.audit import log_change
from app.models import AuditEventType
from app.services.component_merge import bump_linked_task_versions
from app.services.components import recompute_component_completion


def recompute_completion(db: Session, task: Task) -> None:
    if task.component_id and task.component:
        recompute_component_completion(db, task.component)
        return
    stages = db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).all()
    if not stages:
        new_pct = 0
    else:
        done = sum(1 for s in stages if s.is_done)
        new_pct = int(round(done / len(stages) * 100))
    if task.completion_pct != new_pct:
        log_change(db, task, AuditEventType.status, "completion_pct", task.completion_pct, new_pct)
        task.completion_pct = new_pct
    if new_pct == 100:
        if task.status != TaskStatus.done:
            log_change(db, task, AuditEventType.status, "status", task.status.value, TaskStatus.done.value)
            task.status = TaskStatus.done
    elif task.status == TaskStatus.done and new_pct < 100:
        log_change(db, task, AuditEventType.status, "status", task.status.value, TaskStatus.in_progress.value)
        task.status = TaskStatus.in_progress


def complete_all_sub_stages(db: Session, task: Task) -> None:
    if task.component_id and task.component:
        stages = (
            db.query(ComponentSubStage)
            .filter(ComponentSubStage.component_id == task.component_id)
            .all()
        )
        for stage in stages:
            if not stage.is_done:
                stage.is_done = True
        task.component.completion_pct = 100
        task.component.status = TaskStatus.done
        bump_linked_task_versions(task)
        return
    stages = db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).all()
    for stage in stages:
        if not stage.is_done:
            stage.is_done = True
    old_status = task.status
    old_pct = task.completion_pct
    task.completion_pct = 100
    task.status = TaskStatus.done
    log_change(db, task, AuditEventType.status, "completion_pct", old_pct, 100)
    if old_status != TaskStatus.done:
        log_change(db, task, AuditEventType.status, "status", old_status.value, TaskStatus.done.value)

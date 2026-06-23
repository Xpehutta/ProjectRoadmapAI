from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.schemas import ChatRequest, ChatResponse, ChatStatusResponse
from app.services.project_agent import (
    ProjectAgentError,
    ProjectAgentNotConfigured,
    chat,
    is_agent_configured,
)
from app.services.project_context import build_project_context, format_project_context

router = APIRouter(prefix="/projects", tags=["chat"])


@router.get("/{project_id}/chat/status", response_model=ChatStatusResponse)
def chat_status(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    from app.config import settings

    return ChatStatusResponse(
        configured=is_agent_configured(),
        model=settings.gigachat_model if is_agent_configured() else None,
    )


@router.post("/{project_id}/chat", response_model=ChatResponse)
def project_chat(project_id: int, payload: ChatRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    context = build_project_context(db, project_id)
    if not context:
        raise HTTPException(404, "Project not found")

    context_text = format_project_context(context)
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]

    try:
        reply = chat(context_text, messages)
    except ProjectAgentNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except ProjectAgentError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Ошибка GigaChat: {exc}") from exc

    from app.config import settings

    return ChatResponse(reply=reply, model=settings.gigachat_model)

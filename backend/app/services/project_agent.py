"""ИИ-ассистент проекта на базе GigaChat SDK."""

from __future__ import annotations

from typing import Literal

from gigachat import GigaChat
from gigachat.models import Chat, Messages, MessagesRole

from app.config import settings

Role = Literal["user", "assistant"]

SYSTEM_PROMPT = """Ты — ИИ-ассистент дорожной карты проекта. Отвечай на вопросы пользователя о проекте на русском языке.

Правила:
- Используй только данные из JSON-контекста проекта ниже.
- Если информации недостаточно — честно скажи об этом, не выдумывай задачи, даты или статусы.
- При ответах о сроках указывай конкретные даты из контекста.
- Статусы задач: todo (к выполнению), in_progress (в работе), done (выполнено), blocked (заблокировано).
- Этапы (stages) могут быть выполненными (done: true) или запланированными.
- Общие источники (components) — это витрины/источники, используемые несколькими задачами.
- Стоимость: planned_cost — плановая стоимость задачи, actual_cost — фактическая стоимость.
- Трудозатраты: planned_effort — плановые, actual_effort — фактические (часы/чел.-дни).
- custom_fields — дополнительные пользовательские поля задачи.
- shifts — сводка по всему проекту: any (были ли сдвиги), total, stage_shift_count, task_date_shift_count, shift_comment_count, recent (последние события).
- stage_shifts — сдвиги дат этапов в задаче: stage_name, date_field, old, new, days, days_abs, direction.
- date_shifts — сдвиги сроков задачи: field (start_date/end_date/indicative_start/indicative_end), old, new, days.
- shift_comments — комментарии о переносах сроков (этап «…», сдвиг, перенос и т.п.).
- history — полный журнал изменений задачи.
- comments — все комментарии к задаче.
- На вопрос «были ли сдвиги» смотри shifts.any и shifts.recent; если any=false — сдвигов в БД нет (визуальные стрелки только в браузере не учитываются).
- На вопрос «на сколько дней сдвинулся этап» отвечай по stage_shifts: days_abs, направление, old→new.

Контекст проекта (JSON):
{project_context}"""


class ProjectAgentError(Exception):
    pass


class ProjectAgentNotConfigured(ProjectAgentError):
    pass


def is_agent_configured() -> bool:
    return bool(settings.gigachat_credentials)


def _system_content(project_context: str) -> str:
    """Подставляет JSON-контекст без str.format — в промпте есть литеральные {id}."""
    return SYSTEM_PROMPT.replace("{project_context}", project_context)


def _build_client() -> GigaChat:
    if not settings.gigachat_credentials:
        raise ProjectAgentNotConfigured(
            "GigaChat не настроен. Укажите переменную окружения GIGACHAT_CREDENTIALS."
        )
    return GigaChat(
        credentials=settings.gigachat_credentials,
        model=settings.gigachat_model,
        verify_ssl_certs=settings.gigachat_verify_ssl,
        scope=settings.gigachat_scope,
        base_url=settings.gigachat_base_url,
        timeout=120,
    )


def test_connection(prompt: str = "Ответь одним словом: работает") -> str:
    """Короткий запрос для проверки подключения к GigaChat."""
    client = _build_client()
    response = client.chat(prompt)
    return (response.choices[0].message.content or "").strip()


def chat(project_context: str, messages: list[dict[str, str]]) -> str:
    """Синхронный чат с ассистентом. messages — список {role, content}."""
    if not messages:
        raise ProjectAgentError("Сообщения не переданы")
    if messages[-1]["role"] != "user":
        raise ProjectAgentError("Последнее сообщение должно быть от пользователя")

    client = _build_client()
    giga_messages = [
        Messages(
            role=MessagesRole.SYSTEM,
            content=_system_content(project_context),
        )
    ]
    for msg in messages:
        if msg["role"] == "user":
            giga_messages.append(Messages(role=MessagesRole.USER, content=msg["content"]))
        elif msg["role"] == "assistant":
            giga_messages.append(Messages(role=MessagesRole.ASSISTANT, content=msg["content"]))

    response = client.chat(
        Chat(
            model=settings.gigachat_model,
            messages=giga_messages,
            temperature=settings.gigachat_temperature,
            max_tokens=settings.gigachat_max_tokens,
        )
    )
    return (response.choices[0].message.content or "").strip()

"""Интеграция с Jira Cloud REST API."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class JiraError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def jira_configured() -> bool:
    return bool(
        settings.jira_url
        and settings.jira_email
        and settings.jira_api_token
        and settings.jira_project_key
    )


def _base_url() -> str:
    if not settings.jira_url:
        raise JiraError("Jira URL is not configured")
    return settings.jira_url.rstrip("/")


def epic_url(issue_key: str) -> str:
    return f"{_base_url()}/browse/{issue_key}"


def _auth() -> tuple[str, str]:
    if not settings.jira_email or not settings.jira_api_token:
        raise JiraError("Jira credentials are not configured")
    return settings.jira_email, settings.jira_api_token


def _adf_paragraph(text: str) -> dict[str, Any]:
    content: list[dict[str, Any]] = []
    if text.strip():
        content.append({"type": "text", "text": text.strip()})
    return {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": content}],
    }


def _build_epic_fields(name: str, description: str | None) -> dict[str, Any]:
    if not settings.jira_project_key:
        raise JiraError("Jira project key is not configured")

    fields: dict[str, Any] = {
        "project": {"key": settings.jira_project_key},
        "summary": name,
        "issuetype": {"name": "Epic"},
    }
    if description and description.strip():
        fields["description"] = _adf_paragraph(description)
    if settings.jira_epic_name_field:
        fields[settings.jira_epic_name_field] = name
    return fields


async def create_epic(name: str, description: str | None = None) -> dict[str, str]:
    if not jira_configured():
        raise JiraError("Jira integration is not configured")

    payload = {"fields": _build_epic_fields(name, description)}
    url = f"{_base_url()}/rest/api/3/issue"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            json=payload,
            auth=_auth(),
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )

    if response.status_code >= 400:
        detail = response.text
        try:
            body = response.json()
            errors = body.get("errors") or body.get("errorMessages")
            if errors:
                detail = str(errors)
        except Exception:
            pass
        logger.warning("Jira epic creation failed: %s", detail)
        raise JiraError(f"Не удалось создать Epic в Jira: {detail}", response.status_code)

    data = response.json()
    issue_key = data.get("key")
    if not issue_key:
        raise JiraError("Jira не вернула ключ созданного Epic")

    return {"key": issue_key, "url": epic_url(issue_key)}

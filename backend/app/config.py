from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = "postgresql+psycopg://roadmap:roadmap@localhost:15432/roadmap"
    gigachat_credentials: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "GIGACHAT_CREDENTIALS",
            "GIGACHAT_API_KEY",
            "GIGACHAT_EMBEDDINGS_CREDENTIALS",
        ),
    )
    gigachat_model: str = Field(
        default="GigaChat",
        validation_alias=AliasChoices("GIGACHAT_MODEL", "MODEL"),
    )
    gigachat_scope: str | None = None
    gigachat_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GIGACHAT_BASE_URL", "GIGACHAT_API_URL"),
    )
    gigachat_temperature: float = 0.2
    gigachat_max_tokens: int = 2048
    gigachat_verify_ssl: bool = False

    # Email-уведомления об изменениях задач
    notifications_enabled: bool = False
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    notification_from_email: str | None = None
    app_base_url: str = "http://localhost:8080"

    # Jira (создание Epic при создании проекта)
    jira_url: str | None = None
    jira_email: str | None = None
    jira_api_token: str | None = None
    jira_project_key: str | None = None
    jira_epic_name_field: str | None = None

    # Безопасность / развёртывание
    cors_origins: str = "http://localhost:8080,http://localhost:5173"
    require_user_name: bool = False

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://roadmap:roadmap@localhost:5432/roadmap"

    class Config:
        env_file = ".env"


settings = Settings()

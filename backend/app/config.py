"""Runtime configuration. Every value comes from the environment."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Firebase
    google_application_credentials: str | None = None
    firebase_credentials_json: str | None = None
    firebase_project_id: str | None = None

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"

    # Telemetry rules
    stale_data_seconds: int = 120
    command_timeout_seconds: int = 45

    # Device ingest
    device_ingest_key: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "rezervacije-parkiranja"
    environment: str = "development"
    log_level: str = "INFO"

    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "sqlite+aiosqlite:///./data/reservations.db"

    broker_enabled: bool = True
    broker_required: bool = False

    activemq_host: str = "localhost"
    activemq_port: int = 61613
    activemq_user: str = "admin"
    activemq_password: str = "admin"
    activemq_destination: str = "/topic/reservations.events"
    activemq_heartbeat_ms: int = 10000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

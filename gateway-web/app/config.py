from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "gateway-web"
    host: str = "0.0.0.0"
    port: int = 8090
    timeout_seconds: float = 10.0
    circuit_breaker_failure_threshold: int = 3
    circuit_breaker_recovery_timeout_seconds: float = 15.0

    uporabniki_base_url: str = "http://uporabniki:3000"
    parkirisca_base_url: str = "http://parkirisca:8080"
    rezervacije_base_url: str = "http://rezervacije-parkiranja:8000"
    gateway_mobile_base_url: str = "http://gateway-mobile:8091"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

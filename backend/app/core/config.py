import secrets
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: Literal["development", "production", "test"] = "development"
    database_url: str = "postgresql+psycopg://platform_user:platform_password@db:5432/loadtest_platform"
    jwt_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    access_token_cookie_name: str = "access_token"
    jwt_cookie_secure: bool = False
    jwt_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    allow_private_target_hosts: bool | None = None
    auth_rate_limit_window_minutes: int = 15
    auth_rate_limit_max_failures: int = 5
    auth_rate_limit_lock_minutes: int = 15
    database_backup_dir: str = "/app/data/reserve_copies"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_key(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT secret key must be at least 32 characters long")
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        items = [origin.strip() for origin in value.split(",") if origin.strip()]
        if not items:
            raise ValueError("At least one CORS origin must be configured")
        if "*" in items:
            raise ValueError("Wildcard CORS origins are not allowed with authenticated requests")
        return ",".join(items)

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allow_private_target_hosts_effective(self) -> bool:
        if self.allow_private_target_hosts is None:
            return self.environment == "development"
        return bool(self.allow_private_target_hosts)


settings = Settings()

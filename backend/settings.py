from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, env_ignore_empty=True, extra="ignore")

    # Security - must be set in .env (no fallback)
    SECRET_KEY: str = ""

    def model_post_init(self, __context):
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be set in .env (32+ chars). "
                "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )

    # Database
    DATABASE_URL: str = "postgresql://ticketuser:securepassword123@localhost:5432/ticketing"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Rate limiting (login attempts per minute per IP)
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10

    # CORS - frontend can run on same host or different port
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.43.50:3000",
        "http://localhost:8000",  # dev proxy
        "http://127.0.0.1:8000",
    ]


settings = Settings()





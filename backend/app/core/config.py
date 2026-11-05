from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a local .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    APP_NAME: str = "Portfolio CMS API"
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://portfolio:portfolio@localhost:5432/portfolio"
    DB_POOL_SIZE: int = 5  # free hosted databases allow few connections
    DB_MAX_OVERFLOW: int = 5

    # Security
    SECRET_KEY: str = Field(default="change-me-in-production-please-use-a-long-random-string", min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str | None = None
    TRUST_PROXY_HEADERS: bool = True

    # Optional bootstrap admin (created on startup only if no admin exists)
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None
    ADMIN_NAME: str = "Administrator"

    # CORS – the Next.js app proxies /api, so this is mainly for local tooling
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = 240
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_CONTACT_PER_HOUR: int = 5

    # Media storage
    STORAGE_BACKEND: Literal["local", "cloudinary"] = "local"
    MEDIA_ROOT: Path = BASE_DIR / "uploads"
    MEDIA_URL_PREFIX: str = "/uploads"
    CLOUDINARY_URL: str | None = None
    CLOUDINARY_FOLDER: str = "portfolio"
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_PDF_SIZE_MB: int = 15

    # Frontend revalidation webhook
    FRONTEND_URL: str = "http://localhost:3000"
    REVALIDATE_SECRET: str = "change-me-revalidate-secret"

    # Contact notifications (optional SMTP)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_USE_TLS: bool = True
    NOTIFY_EMAIL: str | None = None

    # AI assistant. Keys are read from the environment only and never exposed to the browser.
    GROQ_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    LLM_BASE_URL: str | None = None  # "custom" provider: any OpenAI-compatible /chat/completions endpoint
    LLM_API_KEY: str | None = None
    EMBEDDING_BASE_URL: str | None = None  # used when the embedding provider is "openai"
    EMBEDDING_API_KEY: str | None = None
    ASSISTANT_LLM_TIMEOUT_SECONDS: float = 40.0
    ASSISTANT_LOG_RETENTION_DAYS: int = 90

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalise_database_url(cls, v):
        """Hosts (Neon, Render, Heroku…) hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg driver."""
        if isinstance(v, str):
            v = v.strip()
            for prefix in ("postgres://", "postgresql://"):
                if v.startswith(prefix):
                    return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production:
        insecure = {"change-me-in-production-please-use-a-long-random-string", "change-me-revalidate-secret"}
        if s.SECRET_KEY in insecure or s.REVALIDATE_SECRET in insecure:
            raise RuntimeError("SECRET_KEY and REVALIDATE_SECRET must be set to strong values in production")
    return s


settings = get_settings()

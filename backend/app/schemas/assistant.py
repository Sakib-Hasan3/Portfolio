from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=800)
    history: list[ChatMessageIn] = Field(default_factory=list, max_length=20)
    session_id: str | None = Field(default=None, max_length=64)
    stream: bool = True

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v


class AssistantPublicStatus(BaseModel):
    enabled: bool
    name: str
    welcome_message: str
    placeholder: str
    knowledge_version: int


class AssistantSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    name: str
    welcome_message: str
    placeholder: str
    system_instructions: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    top_k: int
    embedding_provider: str
    embedding_model: str
    rate_limit_per_minute: int
    rate_limit_per_day: int
    global_daily_cap: int
    suggested_questions: list[str]
    enabled_sources: dict[str, bool]
    custom_knowledge: str
    knowledge_version: int
    index_status: str
    index_error: str | None
    last_indexed_at: datetime | None
    chunk_count: int
    # computed (never contains secrets — only whether a key is present)
    llm_configured: bool = False
    embeddings_configured: bool = True


class AssistantSettingsUpdate(BaseModel):
    enabled: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=60)
    welcome_message: str | None = Field(default=None, max_length=800)
    placeholder: str | None = Field(default=None, min_length=1, max_length=120)
    system_instructions: str | None = Field(default=None, max_length=4000)
    provider: Literal["groq", "openai", "custom"] | None = None
    model: str | None = Field(default=None, min_length=1, max_length=100)
    temperature: float | None = Field(default=None, ge=0, le=1.5)
    max_output_tokens: int | None = Field(default=None, ge=64, le=2000)
    top_k: int | None = Field(default=None, ge=3, le=14)
    embedding_provider: Literal["local", "openai"] | None = None
    embedding_model: str | None = Field(default=None, min_length=1, max_length=100)
    rate_limit_per_minute: int | None = Field(default=None, ge=1, le=120)
    rate_limit_per_day: int | None = Field(default=None, ge=1, le=5000)
    global_daily_cap: int | None = Field(default=None, ge=10, le=100000)
    suggested_questions: list[str] | None = Field(default=None, max_length=12)
    enabled_sources: dict[str, bool] | None = None
    custom_knowledge: str | None = Field(default=None, max_length=12000)

    @field_validator("suggested_questions")
    @classmethod
    def clean_questions(cls, v):
        if v is None:
            return v
        out = [q.strip()[:160] for q in v if q and q.strip()]
        return out

    @field_validator("enabled_sources")
    @classmethod
    def known_sources(cls, v):
        from app.models.assistant import DEFAULT_SOURCES

        if v is None:
            return v
        unknown = set(v) - set(DEFAULT_SOURCES)
        if unknown:
            raise ValueError(f"Unknown knowledge source(s): {', '.join(sorted(unknown))}")
        return v

"""Tables backing the AI portfolio assistant.

PostgreSQL stays the source of truth: ``KnowledgeChunk`` rows are a derived,
re-buildable index of *published* portfolio content, never edited by hand.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, JSONType, TimestampMixin, utcnow

DEFAULT_SUGGESTIONS = [
    "Who is Mohammed Sakib Hasan?",
    "Tell me about his research.",
    "What projects has he built?",
    "Does he have Generative AI experience?",
    "What is his educational background?",
    "How can I contact him?",
]

DEFAULT_SOURCES = {
    "profile": True,
    "skills": True,
    "projects": True,
    "publications": True,
    "education": True,
    "experience": True,
    "achievements": True,
    "testimonials": True,
    "notes": True,
    "contact": True,
    "resume": True,
    "custom": True,
}


class AssistantSettings(IdMixin, TimestampMixin, Base):
    """Singleton row. API keys are *never* stored here — they come from environment variables."""

    __tablename__ = "assistant_settings"

    enabled: Mapped[bool] = mapped_column(default=True, nullable=False, server_default="true")
    name: Mapped[str] = mapped_column(String(60), default="Ask Sakib's AI", nullable=False)
    welcome_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    placeholder: Mapped[str] = mapped_column(String(120), default="Ask anything about Sakib...", nullable=False)
    system_instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)

    provider: Mapped[str] = mapped_column(String(20), default="groq", nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="openai/gpt-oss-120b", nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.3, nullable=False)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=700, nullable=False)
    top_k: Mapped[int] = mapped_column(Integer, default=8, nullable=False)

    embedding_provider: Mapped[str] = mapped_column(String(20), default="local", nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), default="text-embedding-3-small", nullable=False)

    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    rate_limit_per_day: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    global_daily_cap: Mapped[int] = mapped_column(Integer, default=1500, nullable=False)

    suggested_questions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    enabled_sources: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    custom_knowledge: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # index state
    knowledge_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    index_status: Mapped[str] = mapped_column(String(16), default="idle", nullable=False)  # idle|indexing|ready|error
    index_error: Mapped[str | None] = mapped_column(Text)
    last_indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")


class KnowledgeChunk(IdMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_chunks"

    chunk_key: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str | None] = mapped_column(String(1024))
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    embedder: Mapped[str] = mapped_column(String(80), nullable=False)
    embedding: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AssistantMessageLog(IdMixin, Base):
    """Minimal per-question analytics. No IP address, no user agent, contact details redacted."""

    __tablename__ = "assistant_message_logs"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), index=True
    )
    session_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    question: Mapped[str] = mapped_column(String(400), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # ok|fallback|blocked|error
    answer_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sources_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    relevant: Mapped[bool] = mapped_column(default=True, nullable=False, server_default="true")
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    model: Mapped[str | None] = mapped_column(String(100))

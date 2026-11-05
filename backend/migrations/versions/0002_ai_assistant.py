"""ai assistant: settings, knowledge chunks, message log

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _ts():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "assistant_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("welcome_message", sa.Text(), nullable=False),
        sa.Column("placeholder", sa.String(120), nullable=False),
        sa.Column("system_instructions", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=False),
        sa.Column("max_output_tokens", sa.Integer(), nullable=False),
        sa.Column("top_k", sa.Integer(), nullable=False),
        sa.Column("embedding_provider", sa.String(20), nullable=False),
        sa.Column("embedding_model", sa.String(100), nullable=False),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False),
        sa.Column("rate_limit_per_day", sa.Integer(), nullable=False),
        sa.Column("global_daily_cap", sa.Integer(), nullable=False),
        sa.Column("suggested_questions", JSON, nullable=False),
        sa.Column("enabled_sources", JSON, nullable=False),
        sa.Column("custom_knowledge", sa.Text(), nullable=False),
        sa.Column("knowledge_version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("index_status", sa.String(16), nullable=False),
        sa.Column("index_error", sa.Text(), nullable=True),
        sa.Column("last_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("chunk_count", sa.Integer(), server_default="0", nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assistant_settings")),
    )
    # Seed the singleton row here so two API workers starting at once can never create duplicates.
    from app.models.assistant import DEFAULT_SOURCES, DEFAULT_SUGGESTIONS
    from app.services.assistant.store import DEFAULT_INSTRUCTIONS, DEFAULT_WELCOME

    settings_table = sa.table(
        "assistant_settings",
        sa.column("enabled", sa.Boolean), sa.column("name", sa.String), sa.column("welcome_message", sa.Text),
        sa.column("placeholder", sa.String), sa.column("system_instructions", sa.Text), sa.column("provider", sa.String),
        sa.column("model", sa.String), sa.column("temperature", sa.Float), sa.column("max_output_tokens", sa.Integer),
        sa.column("top_k", sa.Integer), sa.column("embedding_provider", sa.String), sa.column("embedding_model", sa.String),
        sa.column("rate_limit_per_minute", sa.Integer), sa.column("rate_limit_per_day", sa.Integer),
        sa.column("global_daily_cap", sa.Integer), sa.column("suggested_questions", JSON),
        sa.column("enabled_sources", JSON), sa.column("custom_knowledge", sa.Text), sa.column("knowledge_version", sa.Integer),
        sa.column("index_status", sa.String), sa.column("chunk_count", sa.Integer),
    )
    op.bulk_insert(settings_table, [{
        "enabled": True, "name": "Ask Sakib's AI", "welcome_message": DEFAULT_WELCOME,
        "placeholder": "Ask anything about Sakib...", "system_instructions": DEFAULT_INSTRUCTIONS,
        "provider": "groq", "model": "openai/gpt-oss-120b", "temperature": 0.3, "max_output_tokens": 700, "top_k": 8,
        "embedding_provider": "local", "embedding_model": "text-embedding-3-small",
        "rate_limit_per_minute": 8, "rate_limit_per_day": 60, "global_daily_cap": 1500,
        "suggested_questions": list(DEFAULT_SUGGESTIONS), "enabled_sources": dict(DEFAULT_SOURCES),
        "custom_knowledge": "", "knowledge_version": 0, "index_status": "idle", "chunk_count": 0,
    }])
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("chunk_key", sa.String(160), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(400), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("url", sa.String(1024), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("embedder", sa.String(80), nullable=False),
        sa.Column("embedding", JSON, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_chunks")),
        sa.UniqueConstraint("chunk_key", name=op.f("uq_knowledge_chunks_chunk_key")),
    )
    op.create_index(op.f("ix_knowledge_chunks_source_type"), "knowledge_chunks", ["source_type"])
    op.create_table(
        "assistant_message_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("session_hash", sa.String(64), nullable=False),
        sa.Column("question", sa.String(400), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("answer_chars", sa.Integer(), nullable=False),
        sa.Column("sources_count", sa.Integer(), nullable=False),
        sa.Column("relevant", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assistant_message_logs")),
    )
    op.create_index(op.f("ix_assistant_message_logs_created_at"), "assistant_message_logs", ["created_at"])
    op.create_index(op.f("ix_assistant_message_logs_session_hash"), "assistant_message_logs", ["session_hash"])
    op.create_index(op.f("ix_assistant_message_logs_status"), "assistant_message_logs", ["status"])


def downgrade() -> None:
    op.drop_table("assistant_message_logs")
    op.drop_table("knowledge_chunks")
    op.drop_table("assistant_settings")

"""testimonials and notes

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _common():
    return [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "testimonials",
        *_common(),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("author_role", sa.String(160), nullable=True),
        sa.Column("organization", sa.String(200), nullable=True),
        sa.Column("relationship", sa.String(80), nullable=True),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.String(1024), nullable=True),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_testimonials")),
    )
    op.create_index(op.f("ix_testimonials_is_published"), "testimonials", ["is_published"])
    op.create_table(
        "notes",
        *_common(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", JSON, nullable=False),
        sa.Column("cover_url", sa.String(1024), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
        sa.UniqueConstraint("slug", name=op.f("uq_notes_slug")),
    )
    op.create_index(op.f("ix_notes_is_published"), "notes", ["is_published"])
    op.create_index(op.f("ix_notes_deleted_at"), "notes", ["deleted_at"])
    op.create_index(op.f("ix_notes_published_at"), "notes", ["published_at"])


def downgrade() -> None:
    op.drop_table("notes")
    op.drop_table("testimonials")

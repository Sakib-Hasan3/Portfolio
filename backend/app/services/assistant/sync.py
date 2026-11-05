"""Glue between content edits and the knowledge index (called as a FastAPI background task)."""

from collections.abc import Iterable

from app.services.assistant.knowledge import reindex_safe
from app.services.assistant.retrieval import invalidate_cache
from app.services.revalidation import revalidate


def content_changed(tags: Iterable[str] = ()) -> None:
    """Refresh the Next.js cache, then re-sync the assistant's knowledge base with PostgreSQL."""
    revalidate(tags)
    reindex_safe()
    invalidate_cache()

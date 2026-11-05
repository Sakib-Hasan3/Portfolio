"""Access to the singleton assistant settings row."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssistantSettings
from app.models.assistant import DEFAULT_SOURCES, DEFAULT_SUGGESTIONS

DEFAULT_WELCOME = (
    "Hi! I'm an AI assistant that answers questions about {name}'s professional background — research, projects, "
    "skills, education and how to get in touch. I only use what's published on this portfolio."
)

DEFAULT_INSTRUCTIONS = (
    "Tone: warm, concise and professional. Prefer short paragraphs and tidy bullet lists. "
    "Lead with the direct answer, then add useful detail."
)


def get_or_create(db: Session) -> AssistantSettings:
    row = db.scalars(select(AssistantSettings).order_by(AssistantSettings.id)).first()
    if row is None:
        row = AssistantSettings(
            welcome_message=DEFAULT_WELCOME,
            system_instructions=DEFAULT_INSTRUCTIONS,
            suggested_questions=list(DEFAULT_SUGGESTIONS),
            enabled_sources=dict(DEFAULT_SOURCES),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def source_enabled(row: AssistantSettings, key: str) -> bool:
    return bool((row.enabled_sources or {}).get(key, True))

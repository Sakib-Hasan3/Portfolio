"""Profile/About and Website Settings are single-row resources."""

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models import AdminUser, Profile, WebsiteSettings
from app.schemas.content import ProfileRead, ProfileUpdate, WebsiteSettingsRead, WebsiteSettingsUpdate
from app.services.activity import log_activity
from app.services.revalidation import revalidate

router = APIRouter(tags=["admin:singletons"])


def get_or_create_profile(db: Session) -> Profile:
    profile = db.scalars(select(Profile).order_by(Profile.id)).first()
    if profile is None:
        profile = Profile(full_name="Your Name", title="Your title", specialties=[], about_highlights=[])
        db.add(profile)
        db.commit()
    return profile


def get_or_create_settings(db: Session) -> WebsiteSettings:
    row = db.scalars(select(WebsiteSettings).order_by(WebsiteSettings.id)).first()
    if row is None:
        row = WebsiteSettings(site_title="Portfolio", site_description="", keywords=[], section_visibility={})
        db.add(row)
        db.commit()
    return row


@router.get("/profile", response_model=ProfileRead)
def read_profile(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    return get_or_create_profile(db)


@router.patch("/profile", response_model=ProfileRead)
def update_profile(
    body: ProfileUpdate, bg: BackgroundTasks, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)
):
    profile = get_or_create_profile(db)
    data = body.model_dump(exclude_unset=True)
    for key in ("full_name", "title"):
        if key in data and not data[key]:
            data.pop(key)
    for key, value in data.items():
        setattr(profile, key, value if value is not None or key not in ("specialties", "about_highlights") else [])
    section = "about" if set(data) <= {"about_title", "about_summary", "about_highlights"} else "profile"
    log_activity(db, user, "update", section, profile.id, f"Updated {section}")
    db.commit()
    bg.add_task(revalidate, ("profile",))
    return profile


@router.get("/settings", response_model=WebsiteSettingsRead)
def read_settings(db: Session = Depends(get_db), _: AdminUser = Depends(require_admin)):
    return get_or_create_settings(db)


@router.patch("/settings", response_model=WebsiteSettingsRead)
def update_settings(
    body: WebsiteSettingsUpdate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_admin),
):
    row = get_or_create_settings(db)
    data = body.model_dump(exclude_unset=True)
    if "site_title" in data and not data["site_title"]:
        data.pop("site_title")
    for key, value in data.items():
        if key in ("keywords",) and value is None:
            value = []
        if key == "section_visibility" and value is None:
            value = {}
        setattr(row, key, value)
    log_activity(db, user, "update", "settings", row.id, "Updated website settings")
    db.commit()
    bg.add_task(revalidate, ("settings",))
    return row

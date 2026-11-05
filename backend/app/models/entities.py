from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    Base,
    IdMixin,
    JSONType,
    PublishableMixin,
    SoftDeleteMixin,
    TimestampMixin,
    utcnow,
)

# ---------------------------------------------------------------- auth


class AdminUser(IdMixin, TimestampMixin, Base):
    __tablename__ = "admin_users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Administrator")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="admin", server_default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(IdMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    family_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_id: Mapped[int | None] = mapped_column(Integer)
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[AdminUser] = relationship(back_populates="refresh_tokens")


# ---------------------------------------------------------------- profile


class Profile(IdMixin, TimestampMixin, Base):
    """Singleton row holding identity, hero and about content."""

    __tablename__ = "profiles"

    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    specialties: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    hero_headline: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    hero_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    about_title: Mapped[str] = mapped_column(String(160), nullable=False, default="About")
    about_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    about_highlights: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    location: Mapped[str | None] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    show_phone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    avatar_url: Mapped[str | None] = mapped_column(String(1024))
    available_for_work: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    availability_note: Mapped[str | None] = mapped_column(String(240))


# ---------------------------------------------------------------- skills


class SkillCategory(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "skill_categories"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(64))

    skills: Mapped[list["Skill"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", order_by="Skill.sort_order"
    )


class Skill(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("category_id", "name", name="uq_skills_category_name"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("skill_categories.id", ondelete="CASCADE"), index=True)
    icon: Mapped[str | None] = mapped_column(String(64))
    proficiency: Mapped[int | None] = mapped_column(Integer)  # optional 1-5, never invented

    category: Mapped[SkillCategory] = relationship(back_populates="skills")


# ---------------------------------------------------------------- research


class Publication(IdMixin, TimestampMixin, PublishableMixin, SoftDeleteMixin, Base):
    __tablename__ = "publications"

    title: Mapped[str] = mapped_column(String(400), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text)
    highlights: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    authors: Mapped[str | None] = mapped_column(Text)
    author_position: Mapped[str | None] = mapped_column(String(80))
    venue: Mapped[str] = mapped_column(String(300), nullable=False)
    publication_type: Mapped[str] = mapped_column(String(40), default="conference", nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    doi: Mapped[str | None] = mapped_column(String(200), unique=True)
    pdf_url: Mapped[str | None] = mapped_column(String(1024))
    external_url: Mapped[str | None] = mapped_column(String(1024))
    tags: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)

    projects: Mapped[list["Project"]] = relationship(back_populates="publication")


# ---------------------------------------------------------------- projects


class Project(IdMixin, TimestampMixin, PublishableMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_projects_featured_published", "is_featured", "is_published"),)

    title: Mapped[str] = mapped_column(String(240), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    short_description: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    highlights: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    technologies: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="completed")
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    period_label: Mapped[str | None] = mapped_column(String(40))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024))
    github_url: Mapped[str | None] = mapped_column(String(1024))
    demo_url: Mapped[str | None] = mapped_column(String(1024))
    extra_links: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    publication_id: Mapped[int | None] = mapped_column(ForeignKey("publications.id", ondelete="SET NULL"), index=True)

    publication: Mapped[Publication | None] = relationship(back_populates="projects")
    images: Mapped[list["ProjectImage"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectImage.sort_order"
    )


class ProjectImage(IdMixin, TimestampMixin, Base):
    __tablename__ = "project_images"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(300))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    project: Mapped[Project] = relationship(back_populates="images")


# ---------------------------------------------------------------- background


class Education(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "education"

    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    field_of_study: Mapped[str | None] = mapped_column(String(200))
    institution: Mapped[str] = mapped_column(String(240), nullable=False)
    location: Mapped[str | None] = mapped_column(String(160))
    start_year: Mapped[int | None] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)
    is_expected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    grade: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    highlights: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)


class Experience(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "experiences"

    role: Mapped[str] = mapped_column(String(200), nullable=False)
    organization: Mapped[str] = mapped_column(String(240), nullable=False)
    location: Mapped[str | None] = mapped_column(String(160))
    employment_type: Mapped[str | None] = mapped_column(String(80))
    start_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    end_year: Mapped[int | None] = mapped_column(Integer)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    description: Mapped[str | None] = mapped_column(Text)
    highlights: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)


class Achievement(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "achievements"

    title: Mapped[str] = mapped_column(String(240), nullable=False)
    issuer: Mapped[str | None] = mapped_column(String(240))
    year: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(1024))


class SocialLink(IdMixin, TimestampMixin, PublishableMixin, Base):
    __tablename__ = "social_links"

    platform: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    show_in_hero: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")


# ---------------------------------------------------------------- media & resume


class MediaAsset(IdMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"

    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    public_id: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # image | pdf
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    purpose: Mapped[str | None] = mapped_column(String(40))


class Resume(IdMixin, TimestampMixin, Base):
    __tablename__ = "resumes"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    media_asset_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false", index=True)
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------- contact


class ContactMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "contact_messages"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    is_spam: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(255))


# ---------------------------------------------------------------- settings & audit


class WebsiteSettings(IdMixin, TimestampMixin, Base):
    """Singleton row for site-wide settings."""

    __tablename__ = "website_settings"

    site_title: Mapped[str] = mapped_column(String(160), nullable=False)
    site_description: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    site_url: Mapped[str | None] = mapped_column(String(300))
    keywords: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    og_image_url: Mapped[str | None] = mapped_column(String(1024))
    footer_text: Mapped[str | None] = mapped_column(String(300))
    section_visibility: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    analytics_provider: Mapped[str | None] = mapped_column(String(40))  # plausible | umami | None
    analytics_site_id: Mapped[str | None] = mapped_column(String(200))
    analytics_script_url: Mapped[str | None] = mapped_column(String(500))
    contact_form_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    notify_on_contact: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")


class ActivityLog(IdMixin, Base):
    __tablename__ = "activity_logs"

    user_id: Mapped[int | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(String(400), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now(), index=True
    )

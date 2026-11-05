from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import OptEmail, OptStr, SafeUrl, Slug, StrList, TimestampedRead, make_partial

ProjectStatus = Literal["completed", "in_progress", "maintained", "archived", "prototype"]
PublicationType = Literal["conference", "journal", "preprint", "workshop", "thesis", "other"]


class PublishFields(BaseModel):
    is_published: bool = True
    sort_order: int = Field(default=0, ge=0, le=100000)


# ---------------------------------------------------------------- profile


class ProfileBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=160)
    specialties: StrList = []
    hero_headline: str = Field(default="", max_length=240)
    hero_description: str = Field(default="", max_length=2000)
    about_title: str = Field(default="About", max_length=160)
    about_summary: str = Field(default="", max_length=8000)
    about_highlights: StrList = []
    location: OptStr = Field(default=None, max_length=160)
    email: OptEmail = None
    phone: OptStr = Field(default=None, max_length=40)
    show_phone: bool = False
    avatar_url: SafeUrl = None
    available_for_work: bool = True
    availability_note: OptStr = Field(default=None, max_length=240)


ProfileUpdate = make_partial(ProfileBase, "ProfileUpdate")


class ProfileRead(ProfileBase, TimestampedRead):
    pass


class PublicProfile(BaseModel):
    full_name: str
    title: str
    specialties: list[str]
    hero_headline: str
    hero_description: str
    about_title: str
    about_summary: str
    about_highlights: list[str]
    location: str | None
    email: str | None
    phone: str | None
    avatar_url: str | None
    available_for_work: bool
    availability_note: str | None


# ---------------------------------------------------------------- skills


class SkillCategoryCreate(PublishFields):
    name: str = Field(min_length=1, max_length=120)
    slug: Slug = None
    description: OptStr = Field(default=None, max_length=1000)
    icon: OptStr = Field(default=None, max_length=64)


SkillCategoryUpdate = make_partial(SkillCategoryCreate, "SkillCategoryUpdate")


class SkillCategoryRead(SkillCategoryCreate, TimestampedRead):
    slug: str
    skill_count: int = 0


class SkillCreate(PublishFields):
    name: str = Field(min_length=1, max_length=120)
    category_id: int
    icon: OptStr = Field(default=None, max_length=64)
    proficiency: int | None = Field(default=None, ge=1, le=5)


SkillUpdate = make_partial(SkillCreate, "SkillUpdate")


class SkillRead(SkillCreate, TimestampedRead):
    category_name: str | None = None


class PublicSkill(BaseModel):
    id: int
    name: str
    icon: str | None
    proficiency: int | None


class PublicSkillCategory(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    icon: str | None
    skills: list[PublicSkill]


# ---------------------------------------------------------------- publications


class PublicationCreate(PublishFields):
    title: str = Field(min_length=1, max_length=400)
    slug: Slug = None
    abstract: OptStr = Field(default=None, max_length=10000)
    highlights: StrList = []
    authors: OptStr = Field(default=None, max_length=2000)
    author_position: OptStr = Field(default=None, max_length=80)
    venue: str = Field(min_length=1, max_length=300)
    publication_type: PublicationType = "conference"
    year: int = Field(ge=1950, le=2100)
    doi: OptStr = Field(default=None, max_length=200, pattern=r"^10\.\d{4,9}/\S+$")
    pdf_url: SafeUrl = None
    external_url: SafeUrl = None
    tags: StrList = []


PublicationUpdate = make_partial(PublicationCreate, "PublicationUpdate")


class PublicationRead(PublicationCreate, TimestampedRead):
    slug: str
    deleted_at: datetime | None = None


class PublicPublication(BaseModel):
    id: int
    title: str
    slug: str
    abstract: str | None
    highlights: list[str]
    authors: str | None
    author_position: str | None
    venue: str
    publication_type: str
    year: int
    doi: str | None
    doi_url: str | None
    pdf_url: str | None
    external_url: str | None
    tags: list[str]


# ---------------------------------------------------------------- projects


class LinkItem(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    url: SafeUrl


class ProjectImageIn(BaseModel):
    url: SafeUrl
    caption: OptStr = Field(default=None, max_length=300)


class ProjectImageRead(BaseModel):
    id: int
    url: str
    caption: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class ProjectCreate(PublishFields):
    title: str = Field(min_length=1, max_length=240)
    slug: Slug = None
    short_description: str = Field(min_length=1, max_length=500)
    description: OptStr = Field(default=None, max_length=20000)
    highlights: StrList = []
    technologies: StrList = []
    category: str = Field(min_length=1, max_length=80)
    status: ProjectStatus = "completed"
    year: int | None = Field(default=None, ge=1990, le=2100)
    period_label: OptStr = Field(default=None, max_length=40)
    thumbnail_url: SafeUrl = None
    github_url: SafeUrl = None
    demo_url: SafeUrl = None
    extra_links: list[LinkItem] = Field(default_factory=list, max_length=12)
    is_featured: bool = False
    publication_id: int | None = None
    images: list[ProjectImageIn] = Field(default_factory=list, max_length=30)


ProjectUpdate = make_partial(ProjectCreate, "ProjectUpdate")


class ProjectRead(TimestampedRead):
    title: str
    slug: str
    short_description: str
    description: str | None
    highlights: list[str]
    technologies: list[str]
    category: str
    status: str
    year: int | None
    period_label: str | None
    thumbnail_url: str | None
    github_url: str | None
    demo_url: str | None
    extra_links: list[dict]
    is_featured: bool
    is_published: bool
    sort_order: int
    publication_id: int | None
    images: list[ProjectImageRead]
    deleted_at: datetime | None = None


class PublicPublicationRef(BaseModel):
    id: int
    title: str
    slug: str
    venue: str
    year: int
    doi: str | None


class PublicProject(BaseModel):
    id: int
    title: str
    slug: str
    short_description: str
    description: str | None
    highlights: list[str]
    technologies: list[str]
    category: str
    status: str
    year: int | None
    period_label: str | None
    thumbnail_url: str | None
    github_url: str | None
    demo_url: str | None
    extra_links: list[dict]
    is_featured: bool
    images: list[ProjectImageRead]
    publication: PublicPublicationRef | None


# ---------------------------------------------------------------- education / experience / achievements


class EducationCreate(PublishFields):
    degree: str = Field(min_length=1, max_length=200)
    field_of_study: OptStr = Field(default=None, max_length=200)
    institution: str = Field(min_length=1, max_length=240)
    location: OptStr = Field(default=None, max_length=160)
    start_year: int | None = Field(default=None, ge=1950, le=2100)
    end_year: int | None = Field(default=None, ge=1950, le=2100)
    is_expected: bool = False
    grade: OptStr = Field(default=None, max_length=80)
    description: OptStr = Field(default=None, max_length=4000)
    highlights: StrList = []


EducationUpdate = make_partial(EducationCreate, "EducationUpdate")


class EducationRead(EducationCreate, TimestampedRead):
    pass


class ExperienceCreate(PublishFields):
    role: str = Field(min_length=1, max_length=200)
    organization: str = Field(min_length=1, max_length=240)
    location: OptStr = Field(default=None, max_length=160)
    employment_type: OptStr = Field(default=None, max_length=80)
    start_year: int = Field(ge=1950, le=2100)
    end_year: int | None = Field(default=None, ge=1950, le=2100)
    is_current: bool = False
    description: OptStr = Field(default=None, max_length=4000)
    highlights: StrList = []


ExperienceUpdate = make_partial(ExperienceCreate, "ExperienceUpdate")


class ExperienceRead(ExperienceCreate, TimestampedRead):
    pass


class AchievementCreate(PublishFields):
    title: str = Field(min_length=1, max_length=240)
    issuer: OptStr = Field(default=None, max_length=240)
    year: int | None = Field(default=None, ge=1950, le=2100)
    description: OptStr = Field(default=None, max_length=4000)
    url: SafeUrl = None


AchievementUpdate = make_partial(AchievementCreate, "AchievementUpdate")


class AchievementRead(AchievementCreate, TimestampedRead):
    pass


class SocialLinkCreate(PublishFields):
    platform: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1, max_length=1024)
    show_in_hero: bool = False

    @field_validator("url")
    @classmethod
    def check_url(cls, v: str) -> str:
        v = v.strip()
        if v.startswith("mailto:") and "@" in v and " " not in v:
            return v
        from app.schemas.common import _validate_url

        return _validate_url(v)  # type: ignore[return-value]


SocialLinkUpdate = make_partial(SocialLinkCreate, "SocialLinkUpdate")


class SocialLinkRead(SocialLinkCreate, TimestampedRead):
    pass


# ---------------------------------------------------------------- resume / media


class ResumeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    file_url: SafeUrl
    media_asset_id: int | None = None
    is_active: bool = False
    notes: OptStr = Field(default=None, max_length=2000)

    @field_validator("file_url")
    @classmethod
    def required(cls, v):
        if not v:
            raise ValueError("A resume file is required")
        return v


ResumeUpdate = make_partial(ResumeCreate, "ResumeUpdate")


class ResumeRead(TimestampedRead):
    title: str
    file_url: str
    media_asset_id: int | None
    is_active: bool
    notes: str | None


class MediaAssetRead(TimestampedRead):
    url: str
    provider: str
    public_id: str
    kind: str
    mime_type: str
    size_bytes: int
    original_filename: str | None
    width: int | None
    height: int | None
    purpose: str | None


# ---------------------------------------------------------------- contact


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    # spam protection
    website: str | None = Field(default=None, max_length=200, description="Honeypot – must stay empty")
    elapsed_ms: int | None = Field(default=None, ge=0, description="Time spent on the form")


class ContactUpdate(BaseModel):
    status: Literal["new", "read", "replied", "archived"] | None = None
    is_spam: bool | None = None


class ContactRead(TimestampedRead):
    name: str
    email: str
    subject: str
    message: str
    status: str
    is_spam: bool


# ---------------------------------------------------------------- settings


class WebsiteSettingsBase(BaseModel):
    site_title: str = Field(min_length=1, max_length=160)
    site_description: str = Field(default="", max_length=400)
    site_url: SafeUrl = None
    keywords: StrList = []
    og_image_url: SafeUrl = None
    footer_text: OptStr = Field(default=None, max_length=300)
    section_visibility: dict[str, bool] = Field(default_factory=dict)
    analytics_provider: Literal["plausible", "umami"] | None = None
    analytics_site_id: OptStr = Field(default=None, max_length=200)
    analytics_script_url: SafeUrl = None
    contact_form_enabled: bool = True
    notify_on_contact: bool = True

    @field_validator("analytics_provider", mode="before")
    @classmethod
    def blank_provider(cls, v):
        return None if v in ("", "none") else v


WebsiteSettingsUpdate = make_partial(WebsiteSettingsBase, "WebsiteSettingsUpdate")


class WebsiteSettingsRead(WebsiteSettingsBase, TimestampedRead):
    pass


class PublicSettings(BaseModel):
    site_title: str
    site_description: str
    site_url: str | None
    keywords: list[str]
    og_image_url: str | None
    footer_text: str | None
    section_visibility: dict[str, bool]
    analytics_provider: str | None
    analytics_site_id: str | None
    analytics_script_url: str | None
    contact_form_enabled: bool


# ---------------------------------------------------------------- aggregate


class PublicResume(BaseModel):
    title: str
    file_url: str
    updated_at: datetime


class PortfolioBundle(BaseModel):
    profile: PublicProfile | None
    settings: PublicSettings | None
    social_links: list[SocialLinkRead]
    skills: list[PublicSkillCategory]
    publications: list[PublicPublication]
    projects: list[PublicProject]
    education: list[EducationRead]
    experience: list[ExperienceRead]
    achievements: list[AchievementRead]
    resume: PublicResume | None


class ActivityRead(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None
    summary: str
    created_at: datetime

    model_config = {"from_attributes": True}

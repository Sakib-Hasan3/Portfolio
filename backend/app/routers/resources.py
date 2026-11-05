"""Registry of every CRUD content module exposed under /api/v1/admin/<name>."""

from fastapi import APIRouter

from app.models import (
    Achievement,
    Education,
    Experience,
    Note,
    Project,
    Publication,
    Resume,
    Skill,
    SkillCategory,
    SocialLink,
    Testimonial,
)
from app.routers.factory import build_admin_router
from app.schemas import content as s
from app.services.content import NoteService, ProjectService, ResumeService, SkillCategoryService, SkillService
from app.services.crud import ResourceConfig

RESOURCES: list[ResourceConfig] = [
    ResourceConfig(
        name="projects", label="Project", model=Project,
        create_schema=s.ProjectCreate, update_schema=s.ProjectUpdate, read_schema=s.ProjectRead,
        search_fields=("title", "short_description", "category", "technologies"),
        filter_fields={"category": str, "status": str, "is_featured": bool, "is_published": bool, "year": int},
        order_by=("sort_order", "id"), revalidate_tags=("projects",), slug_from="title",
        service_cls=ProjectService,
    ),
    ResourceConfig(
        name="publications", label="Publication", model=Publication,
        create_schema=s.PublicationCreate, update_schema=s.PublicationUpdate, read_schema=s.PublicationRead,
        search_fields=("title", "venue", "doi", "abstract"),
        filter_fields={"year": int, "publication_type": str, "is_published": bool},
        order_by=("sort_order", "id"), revalidate_tags=("publications", "projects"), slug_from="title",
    ),
    ResourceConfig(
        name="skill-categories", label="Skill category", model=SkillCategory,
        create_schema=s.SkillCategoryCreate, update_schema=s.SkillCategoryUpdate, read_schema=s.SkillCategoryRead,
        search_fields=("name", "description"), filter_fields={"is_published": bool},
        revalidate_tags=("skills",), slug_from="name", title_field="name", service_cls=SkillCategoryService,
    ),
    ResourceConfig(
        name="skills", label="Skill", model=Skill,
        create_schema=s.SkillCreate, update_schema=s.SkillUpdate, read_schema=s.SkillRead,
        search_fields=("name",), filter_fields={"category_id": int, "is_published": bool},
        order_by=("category_id", "sort_order", "id"), revalidate_tags=("skills",), title_field="name",
        service_cls=SkillService,
    ),
    ResourceConfig(
        name="education", label="Education", model=Education,
        create_schema=s.EducationCreate, update_schema=s.EducationUpdate, read_schema=s.EducationRead,
        search_fields=("degree", "institution", "field_of_study"), filter_fields={"is_published": bool},
        revalidate_tags=("education",), title_field="degree",
    ),
    ResourceConfig(
        name="experience", label="Experience", model=Experience,
        create_schema=s.ExperienceCreate, update_schema=s.ExperienceUpdate, read_schema=s.ExperienceRead,
        search_fields=("role", "organization", "description"),
        filter_fields={"is_published": bool, "is_current": bool, "employment_type": str},
        revalidate_tags=("experience",), title_field="role",
    ),
    ResourceConfig(
        name="achievements", label="Achievement", model=Achievement,
        create_schema=s.AchievementCreate, update_schema=s.AchievementUpdate, read_schema=s.AchievementRead,
        search_fields=("title", "issuer", "description"), filter_fields={"is_published": bool, "year": int},
        revalidate_tags=("achievements",),
    ),
    ResourceConfig(
        name="social-links", label="Social link", model=SocialLink,
        create_schema=s.SocialLinkCreate, update_schema=s.SocialLinkUpdate, read_schema=s.SocialLinkRead,
        search_fields=("platform", "label", "url"), filter_fields={"is_published": bool, "platform": str},
        revalidate_tags=("social",), title_field="label",
    ),
    ResourceConfig(
        name="testimonials", label="Testimonial", model=Testimonial,
        create_schema=s.TestimonialCreate, update_schema=s.TestimonialUpdate, read_schema=s.TestimonialRead,
        search_fields=("author_name", "organization", "quote"), filter_fields={"is_published": bool},
        revalidate_tags=("testimonials",), title_field="author_name",
    ),
    ResourceConfig(
        name="notes", label="Note", model=Note,
        create_schema=s.NoteCreate, update_schema=s.NoteUpdate, read_schema=s.NoteRead,
        search_fields=("title", "summary", "content"), filter_fields={"is_published": bool},
        order_by=("id",), revalidate_tags=("notes",), slug_from="title", service_cls=NoteService,
    ),
    ResourceConfig(
        name="resumes", label="Resume", model=Resume,
        create_schema=s.ResumeCreate, update_schema=s.ResumeUpdate, read_schema=s.ResumeRead,
        search_fields=("title", "notes"), filter_fields={"is_active": bool},
        order_by=("id",), revalidate_tags=("resume",), service_cls=ResumeService,
    ),
]


def build_resources_router() -> APIRouter:
    router = APIRouter()
    for cfg in RESOURCES:
        router.include_router(build_admin_router(cfg))
    return router

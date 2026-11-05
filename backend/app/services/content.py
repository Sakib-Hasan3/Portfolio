"""Resource-specific behaviour layered on top of the generic CRUD service."""

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import update

from app.models import Project, ProjectImage, Publication, Resume, Skill, SkillCategory
from app.models.base import Base
from app.schemas.content import ProjectRead, SkillCategoryRead, SkillRead
from app.services.crud import CRUDService


class ProjectService(CRUDService):
    def prepare(self, data: dict[str, Any], obj: Base | None) -> dict[str, Any]:
        data.pop("images", None)
        if "extra_links" in data and data["extra_links"] is not None:
            data["extra_links"] = [dict(link) for link in data["extra_links"]]
        pub_id = data.get("publication_id")
        if pub_id is not None and self.db.get(Publication, pub_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Linked publication does not exist")
        return data

    def after_save(self, obj: Base, raw: dict[str, Any], created: bool) -> None:
        assert isinstance(obj, Project)
        images = raw.get("images")
        if images is None:
            return
        obj.images.clear()
        self.db.flush()
        for i, img in enumerate(images):
            obj.images.append(ProjectImage(url=img["url"], caption=img.get("caption"), sort_order=i))
        self.db.flush()

    def serialize(self, obj: Base):
        return ProjectRead.model_validate(obj)


class SkillService(CRUDService):
    def prepare(self, data: dict[str, Any], obj: Base | None) -> dict[str, Any]:
        cat_id = data.get("category_id")
        if cat_id is not None and self.db.get(SkillCategory, cat_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Skill category does not exist")
        return data

    def serialize(self, obj: Base):
        assert isinstance(obj, Skill)
        read = SkillRead.model_validate(obj)
        read.category_name = obj.category.name if obj.category else None
        return read


class SkillCategoryService(CRUDService):
    def serialize(self, obj: Base):
        assert isinstance(obj, SkillCategory)
        read = SkillCategoryRead.model_validate(obj)
        read.skill_count = len(obj.skills)
        return read


class ResumeService(CRUDService):
    def after_save(self, obj: Base, raw: dict[str, Any], created: bool) -> None:
        assert isinstance(obj, Resume)
        if obj.is_active:
            self.db.execute(update(Resume).where(Resume.id != obj.id).values(is_active=False))
            self.db.flush()


class NoteService(CRUDService):
    def prepare(self, data: dict[str, Any], obj: Base | None) -> dict[str, Any]:
        if data.get("published_at") is None:
            data.pop("published_at", None)  # keep the existing date / let the column default (now) apply
        return data

    def serialize(self, obj: Base):
        from app.schemas.content import NoteRead

        return NoteRead.model_validate(obj, from_attributes=True)

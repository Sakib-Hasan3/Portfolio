"""Generic content service used by every admin CRUD module."""

from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AdminUser
from app.models.base import Base
from app.repositories.base import Repository
from app.services.activity import log_activity
from app.utils.text import slugify


@dataclass
class ResourceConfig:
    name: str  # URL segment, e.g. "projects"
    label: str  # human label, e.g. "Project"
    model: type[Base]
    create_schema: type[BaseModel]
    update_schema: type[BaseModel]
    read_schema: type[BaseModel]
    search_fields: tuple[str, ...] = ()
    filter_fields: dict[str, type] = field(default_factory=dict)
    order_by: tuple[str, ...] = ("sort_order", "id")
    revalidate_tags: tuple[str, ...] = ()
    slug_from: str | None = None
    title_field: str = "title"
    service_cls: type["CRUDService"] | None = None


class CRUDService:
    def __init__(self, config: ResourceConfig, db: Session, user: AdminUser | None = None):
        self.config = config
        self.db = db
        self.user = user
        self.repo: Repository = Repository(config.model, db)

    # ----------------------------------------------------------- hooks
    def prepare(self, data: dict[str, Any], obj: Base | None) -> dict[str, Any]:
        return data

    def after_save(self, obj: Base, raw: dict[str, Any], created: bool) -> None:
        return None

    def serialize(self, obj: Base) -> BaseModel:
        return self.config.read_schema.model_validate(obj)

    # ----------------------------------------------------------- helpers
    def _title(self, obj: Base) -> str:
        return str(getattr(obj, self.config.title_field, "") or f"#{getattr(obj, 'id', '')}")

    def _unique_slug(self, base: str, exclude_id: int | None = None) -> str:
        slug = slugify(base)
        candidate, n = slug, 2
        while True:
            existing = self.repo.get_by(slug=candidate)
            if not existing or existing.id == exclude_id:
                return candidate
            candidate = f"{slug}-{n}"
            n += 1

    def _check_required(self, data: dict[str, Any]) -> None:
        mapper = sa_inspect(self.config.model)
        for key, value in data.items():
            if value is None and key in mapper.columns and not mapper.columns[key].nullable:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"'{key}' cannot be empty")

    def _apply(self, obj: Base, data: dict[str, Any]) -> None:
        mapper = sa_inspect(self.config.model)
        for key, value in data.items():
            if key in mapper.columns:
                setattr(obj, key, value)

    def _commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This conflicts with an existing record (a unique value is already in use)."
            ) from exc

    # ----------------------------------------------------------- operations
    def get_or_404(self, id_: int, include_deleted: bool = False) -> Base:
        obj = self.repo.get(id_, include_deleted=include_deleted)
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{self.config.label} not found")
        return obj

    def list(self, *, q, filters, page, page_size, trash: bool = False):
        order = [getattr(self.config.model, f) for f in self.config.order_by]
        return self.repo.list(
            q=q,
            search_fields=self.config.search_fields,
            filters=filters,
            only_deleted=trash,
            order_by=order,
            page=page,
            page_size=page_size,
        )

    def create(self, payload: BaseModel) -> Base:
        raw = payload.model_dump()
        data = self.prepare(dict(raw), None)
        if self.config.slug_from and "slug" in sa_inspect(self.config.model).columns:
            data["slug"] = self._unique_slug(data.get("slug") or str(data[self.config.slug_from]))
        self._check_required(data)
        obj = self.config.model()
        self._apply(obj, data)
        self.repo.add(obj)
        self.after_save(obj, raw, created=True)
        log_activity(self.db, self.user, "create", self.config.name, obj.id, f"Created {self.config.label.lower()} “{self._title(obj)}”")
        self._commit()
        self.db.refresh(obj)
        return obj

    def update(self, id_: int, payload: BaseModel) -> Base:
        obj = self.get_or_404(id_)
        raw = payload.model_dump(exclude_unset=True)
        data = self.prepare(dict(raw), obj)
        if self.config.slug_from and "slug" in data:
            data["slug"] = self._unique_slug(data["slug"] or str(getattr(obj, self.config.slug_from)), exclude_id=obj.id)
        self._check_required(data)
        self._apply(obj, data)
        self.db.flush()
        self.after_save(obj, raw, created=False)
        if set(data) == {"is_published"}:
            action = "publish" if data["is_published"] else "unpublish"
            summary = f"{'Published' if data['is_published'] else 'Unpublished'} {self.config.label.lower()} “{self._title(obj)}”"
        else:
            action, summary = "update", f"Updated {self.config.label.lower()} “{self._title(obj)}”"
        log_activity(self.db, self.user, action, self.config.name, obj.id, summary)
        self._commit()
        self.db.refresh(obj)
        return obj

    def delete(self, id_: int, hard: bool = False) -> None:
        obj = self.get_or_404(id_, include_deleted=hard)
        title = self._title(obj)
        self.repo.delete(obj, hard=hard)
        log_activity(self.db, self.user, "delete", self.config.name, id_, f"Deleted {self.config.label.lower()} “{title}”")
        self._commit()

    def restore(self, id_: int) -> Base:
        obj = self.get_or_404(id_, include_deleted=True)
        self.repo.restore(obj)
        log_activity(self.db, self.user, "restore", self.config.name, id_, f"Restored {self.config.label.lower()} “{self._title(obj)}”")
        self._commit()
        return obj

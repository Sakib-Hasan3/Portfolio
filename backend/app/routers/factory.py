"""Builds a full admin CRUD router (list/search/filter/get/create/update/publish/delete/restore)."""

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models import AdminUser
from app.schemas.common import Page
from app.services.assistant.sync import content_changed
from app.services.crud import CRUDService, ResourceConfig

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _coerce(value: str, typ: type) -> Any:
    if typ is bool:
        v = value.lower()
        if v in _TRUE:
            return True
        if v in _FALSE:
            return False
        return None
    if typ is int:
        try:
            return int(value)
        except ValueError:
            return None
    return value


def build_admin_router(cfg: ResourceConfig) -> APIRouter:
    router = APIRouter(prefix=f"/{cfg.name}", tags=[f"admin:{cfg.name}"])
    service_cls = cfg.service_cls or CRUDService
    ReadSchema = cfg.read_schema
    CreateSchema = cfg.create_schema
    UpdateSchema = cfg.update_schema

    def svc(db: Session, user: AdminUser) -> CRUDService:
        return service_cls(cfg, db, user)

    filter_doc = ", ".join(cfg.filter_fields) or "none"

    @router.get(
        "", response_model=Page[ReadSchema], summary=f"List {cfg.name}",  # type: ignore[valid-type]
        description=f"Filter query params: {filter_doc}",
    )
    def list_items(
        request: Request,
        q: str | None = Query(None, max_length=200, description=f"Search in: {', '.join(cfg.search_fields)}"),
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=200),
        trash: bool = Query(False, description="Show soft-deleted items"),
        db: Session = Depends(get_db),
        user: AdminUser = Depends(require_admin),
    ):
        filters = {}
        for key, typ in cfg.filter_fields.items():
            raw = request.query_params.get(key)
            if raw not in (None, ""):
                filters[key] = _coerce(raw, typ)
        s = svc(db, user)
        items, total = s.list(q=q, filters=filters, page=page, page_size=page_size, trash=trash)
        return {"items": [s.serialize(i) for i in items], "total": total, "page": page, "page_size": page_size}

    @router.get("/{item_id}", response_model=ReadSchema)
    def get_item(item_id: int, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)):
        s = svc(db, user)
        return s.serialize(s.get_or_404(item_id))

    @router.post("", response_model=ReadSchema, status_code=status.HTTP_201_CREATED)
    def create_item(
        body: CreateSchema,  # type: ignore[valid-type]
        bg: BackgroundTasks,
        db: Session = Depends(get_db),
        user: AdminUser = Depends(require_admin),
    ):
        s = svc(db, user)
        obj = s.create(body)
        bg.add_task(content_changed, cfg.revalidate_tags)
        return s.serialize(obj)

    @router.patch("/{item_id}", response_model=ReadSchema)
    def update_item(
        item_id: int,
        body: UpdateSchema,  # type: ignore[valid-type]
        bg: BackgroundTasks,
        db: Session = Depends(get_db),
        user: AdminUser = Depends(require_admin),
    ):
        s = svc(db, user)
        obj = s.update(item_id, body)
        bg.add_task(content_changed, cfg.revalidate_tags)
        return s.serialize(obj)

    if hasattr(cfg.model, "is_published"):

        @router.post("/{item_id}/publish", response_model=ReadSchema, summary="Publish or unpublish")
        def set_published(
            item_id: int,
            bg: BackgroundTasks,
            published: bool = Query(True),
            db: Session = Depends(get_db),
            user: AdminUser = Depends(require_admin),
        ):
            s = svc(db, user)
            obj = s.update(item_id, UpdateSchema(is_published=published))
            bg.add_task(content_changed, cfg.revalidate_tags)
            return s.serialize(obj)

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(
        item_id: int,
        bg: BackgroundTasks,
        hard: bool = Query(False, description="Permanently delete (soft-deletable resources only)"),
        db: Session = Depends(get_db),
        user: AdminUser = Depends(require_admin),
    ):
        svc(db, user).delete(item_id, hard=hard)
        bg.add_task(content_changed, cfg.revalidate_tags)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if hasattr(cfg.model, "deleted_at"):

        @router.post("/{item_id}/restore", response_model=ReadSchema)
        def restore_item(
            item_id: int, bg: BackgroundTasks, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)
        ):
            s = svc(db, user)
            obj = s.restore(item_id)
            bg.add_task(content_changed, cfg.revalidate_tags)
            return s.serialize(obj)

    return router

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import settings
from app.core.database import get_db
from app.models import AdminUser, MediaAsset
from app.schemas.common import Page
from app.schemas.content import MediaAssetRead
from app.services import storage
from app.services.activity import log_activity

router = APIRouter(prefix="/media", tags=["admin:media"])

Purpose = Literal["avatar", "project-thumbnail", "project-screenshot", "publication-pdf", "resume", "og-image", "misc"]
_EXPECTED = {"publication-pdf": "pdf", "resume": "pdf", "avatar": "image", "project-thumbnail": "image",
             "project-screenshot": "image", "og-image": "image"}


@router.post("/upload", response_model=MediaAssetRead, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    purpose: Purpose = Form("misc"),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_admin),
):
    limit = max(settings.MAX_IMAGE_SIZE_MB, settings.MAX_PDF_SIZE_MB) * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "File too large")
    stored = storage.store(data, folder=purpose, expected=_EXPECTED.get(purpose))
    asset = MediaAsset(
        url=stored.url, provider=stored.provider, public_id=stored.public_id, kind=stored.kind,
        mime_type=stored.mime_type, size_bytes=stored.size_bytes, width=stored.width, height=stored.height,
        original_filename=(file.filename or "")[:255] or None, purpose=purpose,
    )
    db.add(asset)
    db.flush()
    log_activity(db, user, "upload", "media", asset.id, f"Uploaded {stored.kind} “{asset.original_filename or asset.public_id}”")
    db.commit()
    return asset


@router.get("", response_model=Page[MediaAssetRead])
def list_media(
    kind: Literal["image", "pdf"] | None = None,
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(48, ge=1, le=200),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
):
    stmt = select(MediaAsset)
    if kind:
        stmt = stmt.where(MediaAsset.kind == kind)
    if q:
        p = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(MediaAsset.original_filename).like(p), func.lower(MediaAsset.purpose).like(p)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(MediaAsset.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(asset_id: int, db: Session = Depends(get_db), user: AdminUser = Depends(require_admin)):
    asset = db.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")
    if asset.provider == storage.get_storage().provider:
        storage.get_storage().delete(asset.public_id)
    log_activity(db, user, "delete", "media", asset.id, f"Deleted media “{asset.original_filename or asset.public_id}”")
    db.delete(asset)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Media storage with file validation. Cloudinary in production, local disk for development."""

import io
import logging
import secrets
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

log = logging.getLogger("storage")

IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
PDF_TYPE = "application/pdf"
PIL_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp", "GIF": "image/gif"}
Image.MAX_IMAGE_PIXELS = 60_000_000  # guard against decompression bombs


@dataclass
class StoredFile:
    url: str
    public_id: str
    provider: str
    kind: str
    mime_type: str
    size_bytes: int
    width: int | None = None
    height: int | None = None


def sniff(data: bytes) -> tuple[str, str, int | None, int | None]:
    """Returns (kind, mime, width, height) from file *contents*, never the client-supplied type."""
    if data[:5] == b"%PDF-":
        if len(data) > settings.MAX_PDF_SIZE_MB * 1024 * 1024:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"PDF exceeds {settings.MAX_PDF_SIZE_MB} MB")
        return "pdf", PDF_TYPE, None, None
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            width, height = img.size
            img.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported file. Upload a JPEG, PNG, WebP, GIF or PDF."
        ) from exc
    mime = PIL_FORMATS.get(fmt or "")
    if not mime:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported image format")
    if len(data) > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Image exceeds {settings.MAX_IMAGE_SIZE_MB} MB")
    return "image", mime, width, height


class LocalStorage:
    provider = "local"

    def __init__(self, root: Path | None = None):
        self.root = Path(root or settings.MEDIA_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, kind: str, mime: str, folder: str) -> tuple[str, str]:
        ext = "pdf" if kind == "pdf" else IMAGE_TYPES[mime]
        safe_folder = "".join(c for c in folder if c.isalnum() or c in "-_") or "misc"
        name = f"{secrets.token_hex(12)}.{ext}"
        (self.root / safe_folder).mkdir(parents=True, exist_ok=True)
        (self.root / safe_folder / name).write_bytes(data)
        public_id = f"{safe_folder}/{name}"
        return f"{settings.MEDIA_URL_PREFIX}/{public_id}", public_id

    def delete(self, public_id: str) -> None:
        path = (self.root / public_id).resolve()
        if self.root.resolve() in path.parents and path.exists():
            path.unlink()


class CloudinaryStorage:
    provider = "cloudinary"

    def __init__(self):
        import cloudinary

        if not settings.CLOUDINARY_URL:
            raise RuntimeError("CLOUDINARY_URL is required when STORAGE_BACKEND=cloudinary")
        cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)

    def save(self, data: bytes, kind: str, mime: str, folder: str) -> tuple[str, str]:
        import cloudinary.uploader

        result = cloudinary.uploader.upload(
            io.BytesIO(data),
            folder=f"{settings.CLOUDINARY_FOLDER}/{folder}",
            resource_type="image" if kind == "image" else "raw",
            use_filename=False,
            unique_filename=True,
            overwrite=False,
        )
        return result["secure_url"], f"{result.get('resource_type', 'image')}:{result['public_id']}"

    def delete(self, public_id: str) -> None:
        import cloudinary.uploader

        rtype, _, pid = public_id.partition(":")
        try:
            cloudinary.uploader.destroy(pid, resource_type=rtype or "image")
        except Exception as exc:  # noqa: BLE001
            log.warning("cloudinary delete failed: %s", exc)


_storage = None


def get_storage():
    global _storage
    if _storage is None:
        _storage = CloudinaryStorage() if settings.STORAGE_BACKEND == "cloudinary" else LocalStorage()
    return _storage


def store(data: bytes, folder: str, expected: str | None = None) -> StoredFile:
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    kind, mime, w, h = sniff(data)
    if expected and kind != expected:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Expected a {expected.upper()} file")
    backend = get_storage()
    url, public_id = backend.save(data, kind, mime, folder)
    return StoredFile(url=url, public_id=public_id, provider=backend.provider, kind=kind, mime_type=mime,
                      size_bytes=len(data), width=w, height=h)

import re
from datetime import datetime
from typing import Annotated, Any, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, create_model

from app.core.config import settings

T = TypeVar("T")

_URL_RE = re.compile(r"^https?://[^\s<>\"'`]+$", re.IGNORECASE)


def _empty_to_none(v: Any) -> Any:
    if isinstance(v, str) and not v.strip():
        return None
    return v


def _validate_url(v: str | None) -> str | None:
    """Only http(s) URLs or our own media paths — blocks javascript:/data: XSS vectors."""
    if v is None:
        return None
    v = v.strip()
    if v.startswith(settings.MEDIA_URL_PREFIX + "/") and ".." not in v and not re.search(r"\s", v):
        return v
    if not _URL_RE.match(v):
        raise ValueError("Must be an http(s) URL")
    return v


def _url_after(v: str | None) -> str | None:
    return _validate_url(_empty_to_none(v))


SafeUrl = Annotated[Annotated[str, Field(max_length=1024)] | None, AfterValidator(_url_after)]
OptStr = Annotated[str | None, AfterValidator(_empty_to_none)]
OptEmail = Annotated[EmailStr | None, BeforeValidator(_empty_to_none)]


def _clean_list(v: Any) -> Any:
    if v is None:
        return []
    if isinstance(v, str):
        v = [x for x in re.split(r"[\n,]", v)]
    if isinstance(v, list):
        out = []
        for item in v:
            if isinstance(item, str):
                item = item.strip()
                if item:
                    out.append(item)
            else:
                out.append(item)
        return out
    return v


StrList = Annotated[list[Annotated[str, Field(max_length=600)]], BeforeValidator(_clean_list), Field(max_length=60)]

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _validate_slug(v: str | None) -> str | None:
    if v is None:
        return v
    if not _SLUG_RE.match(v):
        raise ValueError("Slug may contain lowercase letters, numbers and single hyphens")
    return v


Slug = Annotated[
    Annotated[str, Field(max_length=200)] | None, AfterValidator(lambda v: _validate_slug(_empty_to_none(v)))
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedRead(ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    detail: str


def make_partial(model: type[BaseModel], name: str | None = None) -> type[BaseModel]:
    """Build an 'update' schema where every field of `model` becomes optional."""
    fields = {}
    for fname, finfo in model.model_fields.items():
        ann = finfo.annotation
        metadata = list(finfo.metadata)
        kwargs: dict[str, Any] = {"default": None}
        if finfo.alias:
            kwargs["alias"] = finfo.alias
        field = Field(**kwargs)
        field.metadata = metadata
        fields[fname] = (ann | None, field)  # type: ignore[operator]
    return create_model(name or f"{model.__name__}Update", __base__=model, **fields)

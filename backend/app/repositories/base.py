from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import Select, String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models.base import Base, utcnow

M = TypeVar("M", bound=Base)


class Repository(Generic[M]):
    """Thin data-access layer around one SQLAlchemy model."""

    def __init__(self, model: type[M], db: Session):
        self.model = model
        self.db = db

    @property
    def soft_delete(self) -> bool:
        return hasattr(self.model, "deleted_at")

    def base_query(self, include_deleted: bool = False) -> Select:
        stmt = select(self.model)
        if self.soft_delete and not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        return stmt

    def get(self, id_: int, include_deleted: bool = False) -> M | None:
        stmt = self.base_query(include_deleted).where(self.model.id == id_)  # type: ignore[attr-defined]
        return self.db.scalars(stmt).first()

    def get_by(self, **kwargs: Any) -> M | None:
        stmt = self.base_query(include_deleted=True).filter_by(**kwargs)
        return self.db.scalars(stmt).first()

    def list(
        self,
        *,
        q: str | None = None,
        search_fields: Sequence[str] = (),
        filters: dict[str, Any] | None = None,
        include_deleted: bool = False,
        only_deleted: bool = False,
        order_by: Sequence[Any] = (),
        page: int = 1,
        page_size: int = 50,
        stmt: Select | None = None,
    ) -> tuple[list[M], int]:
        stmt = stmt if stmt is not None else self.base_query(include_deleted or only_deleted)
        if only_deleted and self.soft_delete:
            stmt = stmt.where(self.model.deleted_at.is_not(None))  # type: ignore[attr-defined]
        if q and search_fields:
            pattern = f"%{q.strip().lower()}%"
            clauses = [func.lower(cast(getattr(self.model, f), String)).like(pattern) for f in search_fields]
            stmt = stmt.where(or_(*clauses))
        for key, value in (filters or {}).items():
            if value is None:
                continue
            stmt = stmt.where(getattr(self.model, key) == value)

        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        if order_by:
            stmt = stmt.order_by(*order_by)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        return list(self.db.scalars(stmt).unique().all()), total

    def add(self, obj: M) -> M:
        self.db.add(obj)
        self.db.flush()
        return obj

    def delete(self, obj: M, hard: bool = False) -> None:
        if self.soft_delete and not hard:
            obj.deleted_at = utcnow()  # type: ignore[attr-defined]
        else:
            self.db.delete(obj)
        self.db.flush()

    def restore(self, obj: M) -> M:
        if self.soft_delete:
            obj.deleted_at = None  # type: ignore[attr-defined]
            self.db.flush()
        return obj

    def count(self, **filters: Any) -> int:
        stmt = select(func.count()).select_from(self.model)
        if self.soft_delete:
            stmt = stmt.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        for k, v in filters.items():
            stmt = stmt.where(getattr(self.model, k) == v)
        return self.db.scalar(stmt) or 0

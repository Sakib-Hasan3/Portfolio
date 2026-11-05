"""Centralised exception handling — every error is JSON: {"detail": str, "code": str, "errors"?: [...]}."""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

log = logging.getLogger("errors")

_CODES = {
    400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict",
    413: "payload_too_large", 415: "unsupported_media_type", 422: "validation_error", 429: "rate_limited",
}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exc(_: Request, exc: HTTPException):
        return JSONResponse(
            {"detail": exc.detail, "code": _CODES.get(exc.status_code, "error")},
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = [str(x) for x in e.get("loc", []) if x not in ("body", "query", "path")]
            msg = e.get("msg", "Invalid value").removeprefix("Value error, ")
            errors.append({"field": ".".join(loc), "message": msg})
        first = errors[0] if errors else {"field": "", "message": "Invalid request"}
        detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse({"detail": detail, "code": "validation_error", "errors": errors}, status_code=422)

    @app.exception_handler(IntegrityError)
    async def integrity_exc(_: Request, exc: IntegrityError):
        log.warning("integrity error: %s", exc.orig)
        return JSONResponse({"detail": "This conflicts with an existing record.", "code": "conflict"}, status_code=409)

    @app.exception_handler(SQLAlchemyError)
    async def db_exc(_: Request, exc: SQLAlchemyError):
        log.exception("database error")
        return JSONResponse({"detail": "A database error occurred.", "code": "database_error"}, status_code=500)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("unhandled error")
        return JSONResponse({"detail": "Something went wrong on our side.", "code": "server_error"}, status_code=500)

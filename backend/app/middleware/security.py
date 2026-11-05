import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.rate_limit import client_ip, limiter

access_log = logging.getLogger("access")

_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        path = request.url.path
        if path.startswith(_DOCS_PATHS):
            h.setdefault("X-Frame-Options", "DENY")
        else:
            if path.startswith(settings.MEDIA_URL_PREFIX):
                # media (e.g. publication PDFs) may be embedded by the site itself
                h.setdefault("X-Frame-Options", "SAMEORIGIN")
                h.setdefault("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'")
                h.setdefault("Cross-Origin-Resource-Policy", "cross-origin")
            else:
                h.setdefault("X-Frame-Options", "DENY")
                h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if settings.is_production:
            h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        if path.startswith(f"{settings.API_V1_PREFIX}/admin") or path.startswith(f"{settings.API_V1_PREFIX}/auth"):
            h["Cache-Control"] = "no-store"
        return response


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Adds a request id, applies the global rate limit and writes a structured access log line."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        ip = client_ip(request)
        if settings.RATE_LIMIT_ENABLED and not request.url.path.startswith(("/health", settings.MEDIA_URL_PREFIX)):
            ok, retry = limiter.hit(f"global:{ip}", settings.RATE_LIMIT_DEFAULT_PER_MINUTE, 60)
            if not ok:
                return JSONResponse(
                    {"detail": "Too many requests. Please slow down.", "code": "rate_limited"},
                    status_code=429,
                    headers={"Retry-After": str(retry), "X-Request-ID": request_id},
                )
        start = time.perf_counter()
        response = await call_next(request)
        duration = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = request_id
        access_log.info(
            "request",
            extra={
                "request_id": request_id, "method": request.method, "path": request.url.path,
                "status": response.status_code, "duration_ms": duration, "client": ip,
            },
        )
        return response

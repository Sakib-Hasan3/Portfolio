"""Tells the Next.js frontend to drop cached data after content changes.

The frontend exposes POST /api/revalidate, protected by a shared secret.
Fetches on the frontend are tagged per resource and with "portfolio".
"""

import logging
from collections.abc import Iterable

import httpx

from app.core.config import settings

log = logging.getLogger("revalidation")


def revalidate(tags: Iterable[str]) -> None:
    tag_list = sorted({*tags, "portfolio"})
    if settings.ENVIRONMENT == "test":
        return
    try:
        resp = httpx.post(
            f"{settings.FRONTEND_URL.rstrip('/')}/api/revalidate",
            json={"tags": tag_list},
            headers={"x-revalidate-secret": settings.REVALIDATE_SECRET},
            timeout=5.0,
        )
        if resp.status_code >= 400:
            log.warning("revalidation failed: %s %s", resp.status_code, resp.text[:200])
        else:
            log.info("revalidated tags %s", tag_list)
    except httpx.HTTPError as exc:  # frontend down is not fatal; time-based revalidation still applies
        log.warning("revalidation request error: %s", exc)

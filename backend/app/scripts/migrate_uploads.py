"""Move locally stored uploads to Cloudinary and rewrite every reference in the database.

Use this once when moving from a local/Docker install (files in /app/uploads) to a host with no persistent disk.

    # dry run (default): shows what would happen, changes nothing
    python -m app.scripts.migrate_uploads
    # do it
    python -m app.scripts.migrate_uploads --apply

Needs DATABASE_URL (the database to rewrite), CLOUDINARY_URL and MEDIA_ROOT (where the old files are).
It is idempotent: once a URL has been rewritten it is no longer found, so re-running is safe.
"""

import argparse
import re
import sys
from pathlib import Path

from sqlalchemy import String, Text, inspect, text

from app.core.config import settings
from app.core.database import engine
from app.services import storage

PATH_RE = re.compile(r"/uploads/[A-Za-z0-9_\-]+/[A-Za-z0-9_\-]+\.(?:jpe?g|png|webp|gif|pdf)", re.I)
SKIP_TABLES = {"knowledge_chunks", "activity_logs", "assistant_message_logs", "alembic_version", "refresh_tokens"}


def find_text_columns() -> list[tuple[str, str]]:
    insp = inspect(engine)
    out = []
    for table in insp.get_table_names():
        if table in SKIP_TABLES:
            continue
        for col in insp.get_columns(table):
            if isinstance(col["type"], (String, Text)):
                out.append((table, col["name"]))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="upload files and rewrite the database (default: dry run)")
    args = ap.parse_args()

    root = Path(settings.MEDIA_ROOT)
    cols = find_text_columns()
    found: dict[str, list[tuple[str, str]]] = {}
    with engine.connect() as conn:
        for table, col in cols:
            rows = conn.execute(text(f'SELECT "{col}" FROM "{table}" WHERE "{col}" LIKE :p'), {"p": "%/uploads/%"}).all()
            for (value,) in rows:
                for m in (x.group(0) for x in PATH_RE.finditer(value or "")):
                    found.setdefault(m, [])
                    if (table, col) not in found[m]:
                        found[m].append((table, col))

    print(f"Database: {engine.url.render_as_string(hide_password=True)}")
    print(f"Files referenced: {len(found)}  (looking in {root})")
    missing = [p for p in found if not (root / p.removeprefix(settings.MEDIA_URL_PREFIX).lstrip("/")).is_file()]
    for p, where in sorted(found.items()):
        flag = "MISSING" if p in missing else "ok     "
        print(f"  {flag} {p}  <- {', '.join(f'{t}.{c}' for t, c in where)}")
    if not args.apply:
        print("\nDry run only. Re-run with --apply to upload and rewrite.")
        return 0
    if missing:
        print(f"\n{len(missing)} referenced file(s) are missing on disk; they will be skipped (their URLs stay unchanged).")
    if not settings.CLOUDINARY_URL:
        print("CLOUDINARY_URL is not set.")
        return 2

    cloud = storage.CloudinaryStorage()
    mapping: dict[str, tuple[str, str]] = {}
    for p in sorted(found):
        if p in missing:
            continue
        data = (root / p.removeprefix(settings.MEDIA_URL_PREFIX).lstrip("/")).read_bytes()
        kind, mime, _, _ = storage.sniff(data)
        folder = p.split("/")[2]
        url, public_id = cloud.save(data, kind, mime, folder)
        mapping[p] = (url, public_id)
        print(f"  uploaded {p} -> {url}")

    with engine.begin() as conn:
        for old, (new, public_id) in mapping.items():
            for table, col in found[old]:
                conn.execute(text(f'UPDATE "{table}" SET "{col}" = REPLACE("{col}", :o, :n) WHERE "{col}" LIKE :like'),
                             {"o": old, "n": new, "like": f"%{old}%"})
            # keep the media library consistent: these rows now live on Cloudinary
            conn.execute(text("UPDATE media_assets SET provider = 'cloudinary', public_id = :pid WHERE url = :u"),
                         {"pid": public_id, "u": new})
    print(f"\nDone: {len(mapping)} file(s) moved, database updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

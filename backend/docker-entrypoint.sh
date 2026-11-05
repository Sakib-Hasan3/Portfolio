#!/bin/sh
set -e

# Apply database migrations on every start (idempotent).
alembic upgrade head

# Optionally load the initial portfolio content. Only empty sections are seeded,
# so this never overwrites edits made in the dashboard.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  python -m app.scripts.seed
fi

exec "$@"

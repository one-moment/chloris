#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/postgres-$TIMESTAMP.sql.gz"
echo "$BACKUP_DIR/postgres-$TIMESTAMP.sql.gz"

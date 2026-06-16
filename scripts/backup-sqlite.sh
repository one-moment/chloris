#!/usr/bin/env sh
set -eu

DB_PATH="${SQLITE_DB_PATH:-./prisma/dev.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "SQLite DB not found: $DB_PATH" >&2
  exit 1
fi

cp "$DB_PATH" "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
gzip -f "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
echo "$BACKUP_DIR/sqlite-$TIMESTAMP.db.gz"

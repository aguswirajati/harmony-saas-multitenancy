#!/usr/bin/env bash
# =============================================================================
# Database Restore Script for Harmony SaaS
# =============================================================================
# Usage:
#   ./scripts/restore.sh backups/saas_db_20260128_120000.sql.gz
#   ./scripts/restore.sh backups/saas_db_20260128_120000.sql.gz my_database
#   DB_HOST=prod-db ./scripts/restore.sh backup.sql.gz
#
# WARNING: This will DROP and recreate the target database!
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file> [database_name]"
    echo ""
    echo "Examples:"
    echo "  $0 backups/saas_db_20260128_120000.sql.gz"
    echo "  $0 backups/saas_db_20260128_120000.sql.gz saas_db_staging"
    echo ""
    echo "Available backups:"
    ls -1t backups/*.sql.gz 2>/dev/null || echo "  (none found in ./backups/)"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load .env if it exists
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | grep -v '^\s*$' | xargs)
fi

# Parse DATABASE_URL or use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${2:-${DB_NAME:-saas_db}}"

echo "=== Harmony SaaS Database Restore ==="
echo "Backup:   $BACKUP_FILE"
echo "Database: $DB_NAME"
echo "Host:     $DB_HOST:$DB_PORT"
echo "User:     $DB_USER"
echo ""
echo "WARNING: This will DROP and recreate database '$DB_NAME'!"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

export PGPASSWORD="${DB_PASS:-}"

echo ""
echo "Dropping existing database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    2>/dev/null || true
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$DB_NAME"

echo "Creating database..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

echo "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet

echo ""
echo "Restore complete."
echo ""
echo "Next steps:"
echo "  1. Verify the data: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
echo "  2. Run migrations if needed: cd backend && alembic upgrade head"

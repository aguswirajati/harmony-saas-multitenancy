#!/usr/bin/env bash
# =============================================================================
# Database Backup Script for Harmony SaaS
# =============================================================================
# Usage:
#   ./scripts/backup.sh                    # Uses defaults from .env
#   ./scripts/backup.sh my_database        # Specify database name
#   DB_HOST=prod-db ./scripts/backup.sh    # Override connection params
#
# Backups are saved to ./backups/ with timestamp in the filename.
# =============================================================================

set -euo pipefail

# Load .env if it exists
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | grep -v '^\s*$' | xargs)
fi

# Parse DATABASE_URL or use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
    # Extract components from DATABASE_URL
    # Format: postgresql://user:password@host:port/dbname
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

# Allow overrides via environment
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${1:-${DB_NAME:-saas_db}}"

# Backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "=== Harmony SaaS Database Backup ==="
echo "Database: $DB_NAME"
echo "Host:     $DB_HOST:$DB_PORT"
echo "User:     $DB_USER"
echo "Output:   $BACKUP_FILE"
echo ""

# Run pg_dump with gzip compression
PGPASSWORD="${DB_PASS:-}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    2>&1 | gzip > "$BACKUP_FILE"

# Verify
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Cleanup old backups (keep last 30)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - 30))
    echo "Removing $REMOVE_COUNT old backup(s)..."
    ls -1t "$BACKUP_DIR"/${DB_NAME}_*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
fi

echo "Done."

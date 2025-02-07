#!/bin/bash
# Set the path for pg_dump
export PATH="/opt/homebrew/bin:$PATH"

# Define variables
DB_NAME="anime_ai_db"
DB_USER="jack"
BACKUP_DIR="/Users/jack/image-generator/server/database/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/$DB_NAME-$TIMESTAMP.sql"

# Ensure the backup directory exists
mkdir -p "$BACKUP_DIR"

# Run pg_dump
pg_dump -U $DB_USER -f "$BACKUP_FILE" "$DB_NAME"

# Check if pg_dump succeeded
if [ $? -eq 0 ]; then
    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE.gz"
else
    echo "pg_dump failed"
fi

# Optional: Delete backups older than 7 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;


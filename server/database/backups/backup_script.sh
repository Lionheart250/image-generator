#!/bin/bash

# Define variables
DB_NAME="anime_ai_db"
DB_USER="jack"
BACKUP_DIR="/Users/jack/image-generator/server/database/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/$DB_NAME-$TIMESTAMP.sql"

# Ensure the backup directory exists
mkdir -p "$BACKUP_DIR"

# Run pg_dump
pg_dump -U $DB_USER -F c -f "$BACKUP_FILE" "$DB_NAME"

# Optional: Compress backup
gzip "$BACKUP_FILE"

# Optional: Delete backups older than X days (e.g., 7 days)
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "Backup completed: $BACKUP_FILE.gz"

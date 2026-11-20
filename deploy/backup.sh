#!/usr/bin/env bash
# Backup harian database SIPREL (aman saat aplikasi berjalan).
set -euo pipefail

DB="/var/lib/siprel/siprel.db"
OUT="/var/backups/siprel"
KEEP=14

mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$OUT/siprel-$STAMP.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$TARGET'"
else
  cp "$DB" "$TARGET"
fi

find "$OUT" -name 'siprel-*.db' -type f -mtime +$KEEP -delete
echo "Backup selesai: $TARGET"

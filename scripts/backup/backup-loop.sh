#!/bin/sh
set -eu

INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-60}"

if [ "${INTERVAL_MINUTES}" -lt 1 ] 2>/dev/null; then
  echo "BACKUP_INTERVAL_MINUTES must be >= 1"
  exit 1
fi

echo "Starting backup loop (interval: ${INTERVAL_MINUTES} minutes)"

while true; do
  /bin/sh /scripts/backup/backup-once.sh
  sleep "$((INTERVAL_MINUTES * 60))"
done

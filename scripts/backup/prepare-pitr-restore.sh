#!/bin/sh
set -eu

: "${BASE_BACKUP_FILE:?BASE_BACKUP_FILE is required}"
: "${RECOVERY_TARGET_TIME:?RECOVERY_TARGET_TIME is required}"

TARGET_ROOT="${TARGET_ROOT:-/restore-target}"
TARGET_DATA_DIR="${TARGET_ROOT}/data"
TARGET_WAL_DIR="${TARGET_ROOT}/wal-archive"
WAL_ARCHIVE_SOURCE_DIR="${WAL_ARCHIVE_SOURCE_DIR:-/wal-archive}"
WAL_ARCHIVE_SNAPSHOT_FILE="${WAL_ARCHIVE_SNAPSHOT_FILE:-}"
PITR_FORCE_OVERWRITE="${PITR_FORCE_OVERWRITE:-false}"

if [ ! -f "${BASE_BACKUP_FILE}" ]; then
  echo "Base backup file not found: ${BASE_BACKUP_FILE}" >&2
  exit 1
fi

if [ -d "${TARGET_DATA_DIR}" ] && [ "$(find "${TARGET_DATA_DIR}" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" -gt 0 ] && [ "${PITR_FORCE_OVERWRITE}" != "true" ]; then
  echo "Target data directory is not empty: ${TARGET_DATA_DIR}. Set PITR_FORCE_OVERWRITE=true to replace it." >&2
  exit 1
fi

rm -rf "${TARGET_DATA_DIR}" "${TARGET_WAL_DIR}"
mkdir -p "${TARGET_DATA_DIR}" "${TARGET_WAL_DIR}"

echo "Preparing PITR restore target in ${TARGET_ROOT}"
tar xzf "${BASE_BACKUP_FILE}" -C "${TARGET_DATA_DIR}"

if [ -n "${WAL_ARCHIVE_SNAPSHOT_FILE}" ]; then
  if [ ! -f "${WAL_ARCHIVE_SNAPSHOT_FILE}" ]; then
    echo "WAL archive snapshot file not found: ${WAL_ARCHIVE_SNAPSHOT_FILE}" >&2
    exit 1
  fi

  tar xzf "${WAL_ARCHIVE_SNAPSHOT_FILE}" -C "${TARGET_WAL_DIR}"
elif [ -d "${WAL_ARCHIVE_SOURCE_DIR}" ]; then
  cp -R "${WAL_ARCHIVE_SOURCE_DIR}/." "${TARGET_WAL_DIR}/"
fi

touch "${TARGET_DATA_DIR}/recovery.signal"

cat >> "${TARGET_DATA_DIR}/postgresql.auto.conf" <<EOF
restore_command = 'cp /restore/wal-archive/%f %p'
recovery_target_time = '${RECOVERY_TARGET_TIME}'
recovery_target_action = 'promote'
EOF

echo "PITR restore target prepared."
echo "Next step: start an isolated PostgreSQL instance with:"
echo "docker run --rm -p 55432:5432 -v ${TARGET_DATA_DIR}:/var/lib/postgresql/data -v ${TARGET_WAL_DIR}:/restore/wal-archive:ro postgres:16-alpine"
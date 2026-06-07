#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DB_BACKUP_DIR="${BACKUP_ROOT}/db"
UPLOADS_BACKUP_DIR="${BACKUP_ROOT}/uploads"
WAL_ARCHIVE_BACKUP_DIR="${BACKUP_ROOT}/wal-archive"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-35}"
INCLUDE_UPLOADS="${BACKUP_INCLUDE_UPLOADS:-true}"
INCLUDE_WAL_ARCHIVE="${BACKUP_INCLUDE_WAL_ARCHIVE:-true}"
BACKUP_S3_URI="${BACKUP_S3_URI:-}"
BACKUP_S3_UPLOADS_PREFIX="${BACKUP_S3_UPLOADS_PREFIX:-uploads}"
BACKUP_S3_WAL_PREFIX="${BACKUP_S3_WAL_PREFIX:-wal-archive}"

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DB_FILE="${DB_BACKUP_DIR}/muninsbok_${TIMESTAMP}.sql.gz"
DB_RAW_FILE="${DB_BACKUP_DIR}/muninsbok_${TIMESTAMP}.sql"

mkdir -p "${DB_BACKUP_DIR}"
mkdir -p "${UPLOADS_BACKUP_DIR}"
mkdir -p "${WAL_ARCHIVE_BACKUP_DIR}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] creating database backup ${DB_FILE}"
pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" > "${DB_RAW_FILE}"

gzip -f "${DB_RAW_FILE}"

if [ ! -s "${DB_FILE}" ]; then
  echo "Database backup file is missing or empty: ${DB_FILE}" >&2
  exit 1
fi

if [ "${INCLUDE_UPLOADS}" = "true" ] && [ -d "/uploads" ]; then
  UPLOADS_FILE="${UPLOADS_BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] creating uploads backup ${UPLOADS_FILE}"
  tar czf "${UPLOADS_FILE}" -C /uploads .
fi

if [ "${INCLUDE_WAL_ARCHIVE}" = "true" ] && [ -d "/wal-archive" ]; then
  WAL_ARCHIVE_FILE="${WAL_ARCHIVE_BACKUP_DIR}/wal_archive_${TIMESTAMP}.tar.gz"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] creating WAL archive snapshot ${WAL_ARCHIVE_FILE}"
  tar czf "${WAL_ARCHIVE_FILE}" -C /wal-archive .
fi

if [ -n "${BACKUP_S3_URI}" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] uploading backups to ${BACKUP_S3_URI}"
  aws s3 cp "${DB_FILE}" "${BACKUP_S3_URI}/db/$(basename "${DB_FILE}")"

  if [ "${INCLUDE_UPLOADS}" = "true" ] && [ -d "/uploads" ] && [ -f "${UPLOADS_FILE:-}" ]; then
    aws s3 cp "${UPLOADS_FILE}" "${BACKUP_S3_URI}/${BACKUP_S3_UPLOADS_PREFIX}/$(basename "${UPLOADS_FILE}")"
  fi

  if [ "${INCLUDE_WAL_ARCHIVE}" = "true" ] && [ -d "/wal-archive" ] && [ -f "${WAL_ARCHIVE_FILE:-}" ]; then
    aws s3 cp "${WAL_ARCHIVE_FILE}" "${BACKUP_S3_URI}/${BACKUP_S3_WAL_PREFIX}/$(basename "${WAL_ARCHIVE_FILE}")"
  fi
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pruning local backups older than ${RETENTION_DAYS} days"
find "${DB_BACKUP_DIR}" -name "muninsbok_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
find "${UPLOADS_BACKUP_DIR}" -name "uploads_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete
find "${WAL_ARCHIVE_BACKUP_DIR}" -name "wal_archive_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup completed"

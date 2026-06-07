#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
BASE_BACKUP_DIR="${BACKUP_ROOT}/base"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-35}"
BACKUP_S3_URI="${BACKUP_S3_URI:-}"
BACKUP_S3_BASE_PREFIX="${BACKUP_S3_BASE_PREFIX:-base}"

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BASE_BACKUP_FILE="${BASE_BACKUP_DIR}/muninsbok_base_${TIMESTAMP}.tar.gz"
BASE_BACKUP_TMP_DIR="/tmp/muninsbok_base_${TIMESTAMP}"

mkdir -p "${BASE_BACKUP_DIR}"
rm -rf "${BASE_BACKUP_TMP_DIR}"
mkdir -p "${BASE_BACKUP_TMP_DIR}"

cleanup() {
  rm -rf "${BASE_BACKUP_TMP_DIR}"
}

trap cleanup EXIT

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] creating physical base backup ${BASE_BACKUP_FILE}"
pg_basebackup \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -D "${BASE_BACKUP_TMP_DIR}" \
  -Fp \
  -X stream \
  -c fast

tar czf "${BASE_BACKUP_FILE}" -C "${BASE_BACKUP_TMP_DIR}" .

if [ ! -s "${BASE_BACKUP_FILE}" ]; then
  echo "Base backup file is missing or empty: ${BASE_BACKUP_FILE}" >&2
  exit 1
fi

if [ -n "${BACKUP_S3_URI}" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] uploading base backup to ${BACKUP_S3_URI}"
  aws s3 cp "${BASE_BACKUP_FILE}" "${BACKUP_S3_URI}/${BACKUP_S3_BASE_PREFIX}/$(basename "${BASE_BACKUP_FILE}")"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pruning base backups older than ${RETENTION_DAYS} days"
find "${BASE_BACKUP_DIR}" -name "muninsbok_base_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] base backup completed"
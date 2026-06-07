#!/bin/sh
set -eu

WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/wal-archive}"
MAX_AGE_MINUTES="${WAL_ARCHIVE_MAX_AGE_MINUTES:-120}"
MIN_FILES="${WAL_ARCHIVE_MIN_FILES:-1}"

if [ ! -d "${WAL_ARCHIVE_DIR}" ]; then
  echo "WAL archive directory does not exist: ${WAL_ARCHIVE_DIR}" >&2
  exit 1
fi

FILE_COUNT="$(find "${WAL_ARCHIVE_DIR}" -maxdepth 1 -type f | wc -l | tr -d ' ')"

if [ "${FILE_COUNT}" -lt "${MIN_FILES}" ]; then
  echo "WAL archive verification failed: expected at least ${MIN_FILES} files, found ${FILE_COUNT}" >&2
  exit 1
fi

LATEST_EPOCH="$(find "${WAL_ARCHIVE_DIR}" -maxdepth 1 -type f -printf '%T@ %p\n' | sort -nr | head -n1 | awk '{print int($1)}')"
NOW_EPOCH="$(date +%s)"
MAX_AGE_SECONDS="$((MAX_AGE_MINUTES * 60))"
AGE_SECONDS="$((NOW_EPOCH - LATEST_EPOCH))"

if [ "${AGE_SECONDS}" -gt "${MAX_AGE_SECONDS}" ]; then
  echo "WAL archive verification failed: newest file is ${AGE_SECONDS}s old (max ${MAX_AGE_SECONDS}s)" >&2
  exit 1
fi

echo "WAL archive verification passed: files=${FILE_COUNT}, newest_age_seconds=${AGE_SECONDS}, max_age_seconds=${MAX_AGE_SECONDS}"
FROM alpine:3.21

RUN apk add --no-cache \
    bash \
    coreutils \
    findutils \
    postgresql16-client \
    tzdata \
    ca-certificates \
    aws-cli \
    tar \
    gzip

WORKDIR /backup

COPY backup-once.sh /scripts/backup/backup-once.sh
COPY base-backup-once.sh /scripts/backup/base-backup-once.sh
COPY backup-loop.sh /scripts/backup/backup-loop.sh
COPY prepare-pitr-restore.sh /scripts/backup/prepare-pitr-restore.sh
COPY verify-wal-archive.sh /scripts/backup/verify-wal-archive.sh

RUN chmod +x /scripts/backup/backup-once.sh /scripts/backup/base-backup-once.sh /scripts/backup/backup-loop.sh /scripts/backup/prepare-pitr-restore.sh /scripts/backup/verify-wal-archive.sh

CMD ["/bin/sh", "/scripts/backup/backup-loop.sh"]

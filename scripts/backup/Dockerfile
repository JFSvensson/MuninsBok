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
COPY backup-loop.sh /scripts/backup/backup-loop.sh

RUN chmod +x /scripts/backup/backup-once.sh /scripts/backup/backup-loop.sh

ENTRYPOINT ["/bin/sh", "/scripts/backup/backup-loop.sh"]

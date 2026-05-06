#!/usr/bin/env bash
set -euo pipefail

BUILD_LOCAL=false
NO_START=false
ENV_FILE=".env.docker"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-local)
      BUILD_LOCAL=true
      shift
      ;;
    --no-start)
      NO_START=true
      shift
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      if [[ -z "$ENV_FILE" ]]; then
        echo "Fel: --env-file kräver ett värde" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Okänd flagga: $1" >&2
      echo "Användning: ./scripts/install-local.sh [--build-local] [--no-start] [--env-file .env.docker]" >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Fel: docker finns inte i PATH" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ ! -f ".env.docker.example" ]]; then
    echo "Fel: hittade varken $ENV_FILE eller .env.docker.example" >&2
    exit 1
  fi

  cp .env.docker.example "$ENV_FILE"
  echo "Skapade $ENV_FILE från .env.docker.example"
  echo "Uppdatera hemligheter i $ENV_FILE innan installationen fortsätter"
  exit 1
fi

docker info >/dev/null

compose_args=( -f docker-compose.yml )
if [[ "$BUILD_LOCAL" == "false" ]]; then
  compose_args+=( -f docker-compose.prod.yml )
fi

if [[ "$NO_START" == "true" ]]; then
  docker compose "${compose_args[@]}" --env-file "$ENV_FILE" config >/dev/null
  echo "Compose-konfiguration validerad"
  exit 0
fi

docker compose "${compose_args[@]}" --env-file "$ENV_FILE" up -d

echo "Installation klar"
echo "Web: http://localhost:5173"
echo "API health: http://localhost:3000/health"

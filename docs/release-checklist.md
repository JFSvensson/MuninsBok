# Release-checklista (lokal distribution)

Denna checklista är avsedd för en release som ska kunna installeras lokalt via Docker.

## 1. Kvalitetssäkring före release

Kör från repo-roten:

- pnpm install --frozen-lockfile
- pnpm -r build
- pnpm test
- npx playwright test --workers=1

Bekräfta att CI är grön.

## 2. Versionsmarkning

- Uppdatera version i release notes/CHANGELOG.
- Skapa tagg:
  - git tag vX.Y.Z
  - git push origin vX.Y.Z

## 3. Build och publicering av images

CI/CD ska bygga och publicera:

- ghcr.io/jfsvensson/muninsbok-api:latest (och versionsspecifik tagg, t.ex. v0.2.0)
- ghcr.io/jfsvensson/muninsbok-web:latest (och versionsspecifik tagg, t.ex. v0.2.0)

Verifiera att image-taggarna finns publicerade.
Vid behov, sätt `IMAGE_TAG=vX.Y.Z` i `.env.docker` för att pinna en specifik release.

## 4. Distributionspaket

Bifoga dessa filer i release (zip/tar):

- docker-compose.yml
- docker-compose.prod.yml
- .env.docker.example
- scripts/install-local.ps1
- scripts/install-local.sh
- scripts/backup/Dockerfile
- scripts/backup/backup-loop.sh
- scripts/backup/backup-once.sh
- docs/production.md
- docs/release-checklist.md

## 5. Installationsinstruktion till slutanvändare

Windows (PowerShell):

- kopiera .env.docker.example till .env.docker
- fyll i hemligheter (framförallt JWT_SECRET och databaslösenord)
- kör: ./scripts/install-local.ps1
- valfritt (automatisk backup): ./scripts/install-local.ps1 -WithBackup

Linux/macOS:

- kopiera .env.docker.example till .env.docker
- fyll i hemligheter
- gör scriptet körbart: chmod +x scripts/install-local.sh
- kör: ./scripts/install-local.sh
- valfritt (automatisk backup): ./scripts/install-local.sh --with-backup

## 6. Verifiering efter installation

- docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.docker ps
- öppna webben: http://localhost:5173
- kontrollera API health: http://localhost:3000/health
- kör restore-verifiering mot testdatabas: pnpm db:verify-restore

Release ska inte markeras som klar om restore-verifieringen ger blockerande fel (exit-kod 1).

## 7. Uppgradering till ny release

- uppdatera .env.docker vid behov
- kör samma installationsscript igen
- scriptet drar ner nya images och startar om containrar

## 8. Rollback-plan

Om problem uppstår:

- byt image-tag i docker-compose.prod.yml till tidigare stabil version
- kör installationsscript igen
- verifiera health endpoint och loggar

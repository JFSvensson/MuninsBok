# Release-checklista (lokal distribution)

Denna checklista är avsedd för en release som ska kunna installeras lokalt via Docker.

## 1. Kvalitetssäkring före release

Kör från repo-roten:

- pnpm install --frozen-lockfile
- pnpm -r build
- pnpm test
- npx playwright test --workers=1
- verifiera att CI-jobbet `restore-verify` är grönt (dump -> restore -> `pnpm db:verify-restore`)

Bekräfta att CI är grön.

### Aktuell verifieringsstatus

- Senaste lokala körningen (2026-10-01) av `npx playwright test --workers=1`: **13 passerade, 0 misslyckades**.
- Lokal API-start verifierad: `/health` rapporterade `status: ok` och `database: ok`.
- Den tidigare lokala blockeringen berodde på en stoppad befintlig PostgreSQL-container, en inaktuell `DATABASE_URL` i repo-rotens ignorerade `.env` och en väntande migration (`0006_add_accounting_events`). Behåll den här statusen som verifieringshistorik; kör alltid om kvalitetsgrindarna för den aktuella releasen.

### Felsökning: Playwright får `ECONNREFUSED` på API-port 3000

`playwright.config.ts` startar redan API:t (`pnpm --filter @muninsbok/api dev`) och webben. Kör inte en extra `pnpm dev` parallellt med Playwright som första åtgärd. Kontrollera API:ts uppstartslogg i Playwright-utskriften. På Windows PowerShell:

```powershell
# Kontrollera att repo-roten har en lokal miljöfil; skapa den vid behov och fyll i värdena.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Starta PostgreSQL. Om Compose rapporterar att muninsbok-db redan finns,
# inspektera containern innan du startar den befintliga containern i stället.
docker compose up -d postgres
docker compose ps postgres
pnpm db:generate
pnpm --filter @muninsbok/db exec prisma migrate status
pnpm --filter @muninsbok/db exec prisma migrate deploy
pnpm --filter @muninsbok/core build

# Generera ett lokalt JWT_SECRET och lägg värdet i .env (committa det inte).
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kontrollera att `.env` har en `DATABASE_URL` till den lokala testdatabasen och ett giltigt `JWT_SECRET`; lägg inte in hemligheter i Git. Om Playwright-loggen inte visar varför API:t stannar, starta `pnpm --filter @muninsbok/api dev` i en separat terminal. När loggen visar att servern lyssnar, verifiera i den första terminalen:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:3000/health
```

Om `docker compose up -d postgres` misslyckas med en namnkrock för `muninsbok-db`, kontrollera först containerns Compose-projekt och status med `docker inspect muninsbok-db --format 'project={{index .Config.Labels "com.docker.compose.project"}} state={{.State.Status}}'`. Starta bara den befintliga containern med `docker start muninsbok-db` om den är rätt lokala databas; ta inte bort containern eller dess volymer som felsökningsåtgärd.

Verifiera att `.env`-filens `DATABASE_URL` autentiserar mot den aktiva databasen. PostgreSQL kan använda lokalt `trust` och ändå neka samma lösenord från Windows; health-endpointens databasstatus eller en hostanslutning verifierar den faktiska appanslutningen. Kontrollera Prisma-status och tillämpa endast väntande, versionshanterade migrationer med `prisma migrate deploy`; använd inte `db:push` mot en databas som innehåller data.

Stoppa den manuellt startade API-processen med Ctrl+C innan Playwright körs igen; Playwright startar själv API och webb. Åtgärda fel med miljövariabler, databasanslutning/migrering eller portkonflikt utifrån loggen. Kör sedan `npx playwright test --workers=1` och kräv **13/13 passerade** innan releasegrinden kan markeras som klar.

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
- scripts/backup/base-backup-once.sh
- scripts/backup/prepare-pitr-restore.sh
- scripts/backup/verify-wal-archive.sh
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
- verifiera WAL-arkivering: docker exec muninsbok-db psql -U muninsbok -d muninsbok -c "SHOW archive_mode;"
- verifiera WAL-aktivitet: docker compose --profile backup -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.docker run --rm backup /bin/sh /scripts/backup/verify-wal-archive.sh
- genomför PITR-övning med senaste base backup enligt docs/production.md före större release eller minst kvartalsvis

CI ska redan ha verifierat restoreflödet via jobbet `restore-verify`. Den lokala kontrollen här är en extra driftverifiering inför eller efter faktisk installation.

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

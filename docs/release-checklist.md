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

- Senaste kända lokala körningen (2026-10-01) av `npx playwright test --workers=1`: **2 passerade, 11 misslyckades**.
- De misslyckade testerna kunde inte ansluta till API:t på `127.0.0.1:3000` / `localhost:3000` (`ECONNREFUSED`). Health-kontrollen på `/health` kunde inte heller nå API:t.
- **Releasegrinden är blockerad** tills API-startfelet har diagnostiserats, hela E2E-sviten körts om och samtliga tester passerar. Felutskriften visar att API:t inte var tillgängligt; den fastställer ensam inte varför uppstarten misslyckades.

### Felsökning: Playwright får `ECONNREFUSED` på API-port 3000

`playwright.config.ts` startar redan API:t (`pnpm --filter @muninsbok/api dev`) och webben. Kör inte en extra `pnpm dev` parallellt med Playwright som första åtgärd. Kontrollera API:ts uppstartslogg i Playwright-utskriften. På Windows PowerShell:

```powershell
# Kontrollera att repo-roten har en lokal miljöfil; skapa den vid behov och fyll i värdena.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Använd endast en lokal testdatabas: db:push ändrar databasschemat.
# Starta PostgreSQL och säkerställ att Prisma-klienten/schema är förberedda.
docker compose up -d postgres
pnpm db:generate
pnpm db:push
pnpm --filter @muninsbok/core build

# Generera ett lokalt JWT_SECRET och lägg värdet i .env (committa det inte).
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Kontrollera att `.env` har en `DATABASE_URL` till den lokala testdatabasen och ett giltigt `JWT_SECRET`; lägg inte in hemligheter i Git. Om Playwright-loggen inte visar varför API:t stannar, starta `pnpm --filter @muninsbok/api dev` i en separat terminal. När loggen visar att servern lyssnar, verifiera i den första terminalen:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:3000/health
```

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

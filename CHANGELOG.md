# Changelog

Alla viktiga ändringar i projektet dokumenteras i denna fil.

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/)
och projektet använder [Semantic Versioning](https://semver.org/lang/sv/).

## [Unreleased]

## [0.2.0] — 2026-05-06

### Tillagt
- **CONTRIBUTING.md**: ny sektion "Felsökning av Docker & e2e" med recovery-checklista och vanliga e2e-problem.
- **docs/production.md**: ny sektion "Felsökning: API-container och kodmismatch" med diagnostik och åtgärder.
- **.gitignore**: regler för lokala debug-loggar (`*.log`, `*-exit.txt`, `tmp-*`).
- **pnpm-workspace.yaml**: `onlyBuiltDependencies`-lista för att godkänna build-skript för `@prisma/engines`, `core-js`, `esbuild`, `prisma` och `tesseract.js` — krävs av pnpm 11:s nya säkerhetsmodell.

### Ändrat
- **pnpm** uppgraderad från 8.15.1 → 10.33.4 → **11.0.6** (senaste stabila).
  - `package.json`: `packageManager` och `engines.pnpm` uppdaterade.
  - `apps/api/Dockerfile` och `apps/web/Dockerfile`: pnpm-pin uppdaterad.
  - `.github/workflows/ci.yml`: båda `pnpm/action-setup`-steg uppdaterade.
  - `pnpm-lock.yaml`: regenererad med nytt lockfile-format (lockfileVersion 9.0).
- **Prisma** uppgraderad till 7.8.0 — `apps/api/Dockerfile` installerar nu `prisma@7.8.0` globalt (matchar `@prisma/client`-versionen).
- **Docker**: basimage uppdaterad till `node:22-alpine`, nginx till `nginx:1.29-alpine`.
- **CI** (`.github/workflows/ci.yml`): triggers utökade med `push.tags: ['v*']` för release-taggar.
- **CD** (`.github/workflows/cd.yml`):
  - GHCR-lowercase-fel åtgärdat (bash `${GITHUB_REPOSITORY_OWNER,,}` istället för ogiltigt `| lower`-filter).
  - `deploy`-jobbet utkommenterat tills produktionsserver är konfigurerad.
- **E2E**: `playwright.config.ts` laddar nu `.env` via `dotenv` så att `JWT_SECRET` finns tillgänglig lokalt.
- **CONTRIBUTING.md**: pnpm-krav uppdaterat till `≥ 11`.
- **README.md**: tech stack-tabell och teststatus uppdaterade (pnpm 11, Prisma 7.8, 1 374 tester).

### Fixat
- **Banking e2e**: routes `POST /bank/connect/init` och `POST /bank/connect/callback` returnerade 404 i e2e-tester. Orsak: Docker API-image var inte ombyggd efter kodändringar. Löst genom rebuild-rutin (`docker compose build --no-cache api`).
- **JWT_SECRET**: lokal E2E-körning kraschade med "JWT_SECRET must be at least 32 characters" — `.env` lästes inte in av Playwright. Åtgärdat med `dotenv`-laddning i `playwright.config.ts`.

## [0.1.0] — 2026-04-20

### Tillagt

#### Bokföring
- Dubbel bokföring via verifikat med balansvalidering
- Kontoplan med förenklad BAS som standard
- Rättelseverifikat (BFL 5:5)
- Löpnumrering med luckkontroll (BFL 5:6)
- Dokumenthantering — bifoga underlag till verifikat
- Sökfunktion och paginering för verifikat
- Verifikatmallar — spara och återanvänd vanliga bokföringshändelser

#### Budget
- Budgetera per konto och period
- Skapa, redigera och radera budgetar med kontofördelade poster
- Budget mot utfall — jämförelse med avvikelseanalys

#### Rapporter
- Råbalans, resultaträkning, balansräkning
- Momsrapport och SKV Momsdeklaration (SKV 4700)
- Periodrapport med diagram och jämförelsetabell
- Kontoanalys med grafer, trender och saldo över tid
- Grundbok, huvudbok, verifikationslista
- Dashboard med översikt, månadstrend och nyckeltal
- Datumfilter, CSV-export och utskrift på alla rapporter
- PDF-export (råbalans, resultaträkning, balansräkning, momsrapport, huvudbok, bokslut)

#### Årsbokslut
- Boksluts-förhandsvisning
- Automatisk nollställning av resultaträkningskonton mot 2099
- Balanskontroll, stängning av räkenskapsår med bokslutsverifikat
- Ingående balanser (IB) från föregående år
- Resultatdisposition (2099 → 2091)
- Sammanställning av årsbokslut

#### Import/export
- SIE4-import och export (med IB/UB/RES)

#### Autentisering & säkerhet
- JWT-autentisering med access + refresh-tokens (jti-baserad återkallning)
- Rollbaserad behörighet (OWNER / ADMIN / MEMBER)
- httpOnly-cookie för refresh-token
- Auth-specifik rate limiting (register: 5/min, login: 10/min)
- Audit-logging för skrivoperationer
- Input-sanitering, Helmet-headers, CORS
- HSTS-header i nginx

#### Drift & infrastruktur
- Docker Compose med multi-stage builds, non-root containers och healthchecks
- Request-timeouts (connection: 10 s, request: 30 s)
- Konfigurerbar databaspool (DATABASE_POOL_SIZE)
- Strukturerad loggning med log-rotation
- Graceful shutdown
- Swagger/OpenAPI-dokumentation

#### Test
- 636+ enhetstester (core, db, api, web)
- E2E-tester med Playwright
- CI via GitHub Actions

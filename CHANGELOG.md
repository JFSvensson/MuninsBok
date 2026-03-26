# Changelog

Alla viktiga ändringar i projektet dokumenteras i denna fil.

Formatet följer [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/)
och projektet använder [Semantic Versioning](https://semver.org/lang/sv/).

## [Unreleased]

### Fixat
- **Banking e2e**: routes `POST /bank/connect/init` och `POST /bank/connect/callback` returnerade 404 i e2e-tester. Orsak: Docker API-image var inte ombyggd efter kodändringar. Löst genom rebuild-rutin (`docker compose build --no-cache api`).

### Tillagt
- **CONTRIBUTING.md**: ny sektion "Felsökning av Docker & e2e" med recovery-checklista och vanliga e2e-problem.
- **docs/production.md**: ny sektion "Felsökning: API-container och kodmismatch" med diagnostik och åtgärder.
- **.gitignore**: regler för lokala debug-loggar (`*.log`, `*-exit.txt`, `tmp-*`).

## [0.1.0] — 2025-06-22

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

# Munins bok (muninsbok)

**Munins bok** är en öppen källkods-bokföringsapp för småföretag och föreningar i Sverige.

Målet är att göra bokföring **enkel, transparent och självhostbar** — utan att låsa in användare, data eller arbetsflöden.

> Munin (fornnordiskt väsen) symboliserar minne och överblick.  
> Munins bok ska vara en trygg plats för dina siffror.

---

## Vision

- **Självhostbar bokföring** som du kan köra på din egen server.
- **Öppen källkod** som föreningar och småföretag kan lita på.
- **Korrekt bokföringslogik** med testad domänmodell.
- **Svensk verklighet först**: BAS-kontoplan, verifikat, moms, SIE.

---

## Funktioner

### Bokföring
- Dubbel bokföring via verifikat
- Kontoplan med förenklad BAS som standard
- Rättelseverifikat (BFL 5:5)
- Löpnumrering med luckkontroll (BFL 5:6)
- Dokumenthantering (bifoga underlag till verifikat)
- OCR/kvitto-tolkning med förslag för datum, beskrivning och belopp (JPG/PNG/WebP, samt PDF via feature-flag)
- Sökfunktion och paginering för verifikat

### Rapporter
- Råbalans (trial balance)
- Resultaträkning
- Balansräkning
- Momsrapport
- SKV Momsdeklaration (SKV 4700 — alla rutor)
- Periodrapport (månads- eller kvartalsvy med diagram och jämförelsetabell)
- Kontoanalys — djupanalys per konto med grafer, trender och saldo över tid
- Grundbok (journal)
- Huvudbok (general ledger)
- Verifikationslista
- Dashboard med översikt, månadstrend, nyckeltal, årsjämförelse och prognos
- Global sökfunktion (Ctrl+K) — sök verifikat och konton direkt från huvudmenyn
- Datumfilter på alla rapporter
- CSV-export och utskrift på alla rapporter
- PDF-export (råbalans, resultaträkning, balansräkning, momsrapport, huvudbok, bokslut, grundbok, kontoanalys, budget vs utfall, SKV 4700)

### Årsbokslut
- Boksluts-förhandsvisning — visar exakt vilka bokslutsposter som skapas innan du stänger
- Automatisk nollställning av resultaträkningskonton mot 2099 (Årets resultat)
- Balanskontroll av bokslutsverifikatet
- Stängning av räkenskapsår med bokslutsverifikat
- Ingående balanser (IB) från föregående år
- Resultatdisposition — automatisk överföring av 2099 (Årets resultat) → 2091 (Balanserat resultat)
- Sammanställning av årsbokslut — kompilerad rapport med resultaträkning, balansräkning och dispositionsdetaljer

### Verifikatmallar
- Spara och återanvänd vanliga bokföringshändelser (t.ex. månadshyra, lön)
- Skapa, redigera och radera mallar
- Fyll i verifikat direkt från mall

### Budget
- Budgetera per konto och period
- Skapa, redigera och radera budgetar med kontofördelade poster
- Budget mot utfall — jämför budgeterade belopp mot verkligt utfall med avvikelseanalys

### Återkommande verifikatmallar
- Schemalägg verifikat att skapas automatiskt (månatligen eller kvartalsvis)
- Ange dag i månaden och valfritt slutdatum
- Visa och kör förfallna mallar direkt från mallsidan
- Automatisk beräkning av nästa körning

### Import/export
- SIE4 (med IB/UB/RES)
- CSV (alla rapporter)
- Verifikatimport från CSV (bankutdrag → verifikat) med 4-stegs wizard (uppladdning → kolumnmappning → förhandsgranskning → resultat)

### Bankkoppling
- Organisationsstyrd feature-gating via `BANK_ENABLED_ORG_IDS` och `VITE_BANK_ENABLED_ORG_IDS`
- OAuth-baserad bankanslutning med synkstatus och autentiseringsförnyelse
- Manuell transaktionssynk med historik över synkkörningar
- Matchningskandidater med score och förklaringar (belopp, datum, beskrivning)
- Matcha, avmatcha och bekräfta banktransaktioner
- Skapa verifikat direkt från banktransaktion och bekräfta matchning

### Attestflöde
- Konfigurera attestregler baserat på beloppsintervall och rollkrav
- Flerstegsattest med stöd för stegordning
- Skicka verifikat för attestering
- Godkänn eller avvisa med valfri kommentar
- Visa väntande attester per organisation
- Automatgodkännande när inga matchande regler finns

### Fakturering
- Kundregister med automatisk kundnumrering
- Skapa, redigera och radera fakturor med dynamiska rader
- Automatisk beloppsberäkning (netto, moms, totalt) i öre
- Momshantering med valfria satser (25 %, 12 %, 6 %, 0 %)
- Statushantering: utkast → skickad → betald/förfallen/makulerad/krediterad
- Statusvalidering med tillståndsmaskin (ogiltig övergång nekas)
- Kreditfakturor (länkning till originalfaktura)
- Koppling faktura → verifikat vid betalning
- Kundvy med alla fakturor för en kund
- Statusfilter på fakturalista

### Flerspråksstöd (i18n)
- Svenska (standard) och engelska
- Språkväljare i headern
- Sparas i localStorage — val kvarstår mellan sessioner
- ~280 översättningsnycklar som täcker alla delar av appen
- Banking-modulen är internationaliserad i sv/en, inklusive actions, status, felmeddelanden och kandidatväljare

### Autentisering & säkerhet
- JWT-autentisering (access-token i minnet + refresh-token som httpOnly-cookie med jti-baserad återkallning)
- Rollbaserad behörighet (OWNER / ADMIN / MEMBER)
- Audit-logging
- Rate limiting
- Input-sanitering
- Helmet-headers

### Drift
- Självhostbar via Docker Compose
- Dark mode med systempreferensdetektering (light / dark / system)
- Health check-endpoint (i docker-compose och Dockerfile)
- Prometheus `/metrics`-endpoint med HTTP-statistik och Node.js runtime-metrics (aktiveras i produktion via `METRICS_TOKEN`)
- Automatisk rensning av utgångna refresh-tokens vid uppstart och schemalagt
- Strukturerad loggning med json-file-drivrutin och log-rotation
- Request-timeouts och konfigurerbar databaspool
- Swagger/OpenAPI-dokumentation (UI avstängd som standard i produktion; aktiveras via `ENABLE_DOCS=true`)
- CD-pipeline — automatiserad deploy via GitHub Actions → GHCR → SSH

---

## Produktionsstatus

Applikationen är **produktionsklar** för självhostning av småföretag och föreningar. Följande säkerhetsmekanismer finns på plats:

- **Autentisering**: JWT med access-token i minnet, refresh-token som httpOnly-cookie, server-side återkallning (jti), automatisk token-cleanup. `JWT_SECRET` krävs i produktion.
- **Auktorisering**: Rollbaserad behörighet (OWNER / ADMIN / MEMBER) med org-scoped membership
- **Input**: Zod-validering på alla API-endpoints, body-storleksgräns (1 MB), input-sanitering
- **Transport**: Helmet-headers, CORS-konfiguration, rate limiting med skärpt gräns på auth-endpoints
- **Webhooks**: HMAC-signaturverifiering for bank-webhooks via `x-webhook-signature` (global eller providerspecifik hemlighet)
- **Bank-OAuth**: Signerad `state` verifieras server-side och callback-URL:er begränsas via `BANK_OAUTH_REDIRECT_URI_ALLOWLIST`
- **Infrastruktur**: Multi-stage Docker, non-root containers, healthchecks, log-rotation, graceful shutdown
- **Drift**: Request-timeouts, konfigurerbar anslutningspool, strukturerad loggning, audit trail, Swagger UI avstängd som standard i produktion och `/metrics` endast exponerad när `METRICS_TOKEN` är satt
- **Tester**: 1 366 enhetstester (inkl. React Testing Library-komponenttester) + E2E med Playwright, CI via GitHub Actions

Se [docs/production.md](docs/production.md) för fullständig driftsättningsguide.

Bank-webhook-signaturer i produktion konfigureras via `BANK_WEBHOOK_HMAC_SECRET` eller `BANK_WEBHOOK_<PROVIDER>_HMAC_SECRET`.
Produktionsreglage för introspektionsytor: `ENABLE_DOCS=true` exponerar `/docs`, och `METRICS_TOKEN` krävs för att exponera `/metrics`.

---

## Framtida utveckling

Inga större produktfunktioner är planerade för tillfället. Fokus ligger på säkerhetshärdning, driftförenkling och dokumentation som speglar faktisk kod och produktion.

---

## Licens

Koden är licensierad under **GNU Affero General Public License v3.0 (AGPLv3)**.

Det betyder i korthet:
- Du får använda, ändra och distribuera koden fritt.
- Om du kör en modifierad version som en nätverkstjänst måste du erbjuda källkoden till användarna.

Se `LICENSE`.

---

## Tech stack

| Lager | Teknik |
|-------|--------|
| **Frontend** | React 19 + Vite 8 + TypeScript 6.0 |
| **Backend** | Node.js 22+ + Fastify 5 + TypeScript 6.0 |
| **Databas** | PostgreSQL 16+ (Prisma 7.7) |
| **Auth** | JWT (access + refresh) med jti-baserad tokenåterkallning |
| **Monorepo** | pnpm workspaces |
| **Test** | Vitest + React Testing Library |
| **Deploy** | Docker Compose |

---

## Kom igång

### Förutsättningar

- Node.js 22+
- pnpm 8+
- PostgreSQL 16+ (eller Docker)

### Lokal utveckling

```bash
# Klona repot
git clone https://github.com/your-username/muninsbok.git
cd muninsbok

# Installera dependencies
pnpm install

# Kopiera environment-variabler
cp .env.example .env
# Redigera .env — byt JWT_SECRET och eventuellt lösenord

# Starta PostgreSQL (kör med Docker om du inte har lokalt)
docker compose up postgres -d

# Generera Prisma-klient och pusha schema till databasen
pnpm --filter @muninsbok/db exec prisma generate
pnpm db:push

# Bygg paketen
pnpm --filter @muninsbok/db build
pnpm --filter @muninsbok/core build

# Starta utvecklingsservrar
pnpm dev
```

Frontend: http://localhost:5173  
API: http://localhost:3000

OCR i denna version fungerar for bildkvitton (JPG, PNG, WebP). PDF-stod finns via feature-flag (`OCR_ENABLE_PDF=true`) och lokal konvertering med `pdftoppm`. HEIC kan fortfarande bifogas som dokument, men OCR-tolkning ar inte aktiverad for det formatet an.

### Kör tester

```bash
# Alla tester i alla paket
pnpm test

# Enbart core-domänlogik
pnpm --filter @muninsbok/core test

# Enbart API-validering
pnpm --filter @muninsbok/api test

# Enbart web-utilities
pnpm --filter @muninsbok/web test
```

### Docker

Kör hela stacken med Docker Compose:

```bash
docker compose up --build
```

### Docker felsökning

Om API-containern fastnar vid databasmigrering kan du styra beteendet med miljövariabeln `DB_MIGRATION_MODE`:

- `deploy` - kör endast `prisma migrate deploy` (strikt, rekommenderas i produktion)
- `fallback` - försöker `migrate deploy`, faller tillbaka till `db push --accept-data-loss` vid fel (praktiskt lokalt)
- `push` - kör alltid `db push --accept-data-loss`
- `skip` - hoppar över migrering helt

Exempel:

```bash
DB_MIGRATION_MODE=deploy docker compose up --build
```

Standard i `docker-compose.yml` är `fallback` om variabeln inte är satt.

För PDF-OCR (lokal konvertering i API-container) kan du slå på feature-flaggen:

```bash
OCR_ENABLE_PDF=true docker compose up --build
```

I Docker-installationen används `pdftoppm` (Poppler). Om du kör API lokalt utan Docker behöver motsvarande binär finnas installerad i din miljö.

### Produktion

Se [docs/production.md](docs/production.md) för:

- TLS/HTTPS med nginx & Let's Encrypt
- Backup & återställning av databas och filer
- Övervakning med health check
- Säkerhetsrekommendationer

---

## Repo-struktur

```txt
muninsbok/
  apps/
    web/                  # React UI (Vite + React Router)
    api/                  # REST API (Fastify + Zod-validering)
  packages/
    core/                 # Ren bokföringslogik (ingen DB, ingen HTTP)
    db/                   # Prisma schema + repositories + mappers
  LICENSE
  README.md
```

---

## Teststatus

**1 366 enhetstester** fördelade på 127 testfiler:

| Paket | Testfiler | Tester | Vad som testas |
|-------|-----------|--------|----------------|
| `@muninsbok/core` | 25 | 360 | Result-typer, organisationsnummer (Luhn), kontotyper, kontoplan (BAS), räkenskapsår (max 18 mån), verifikatrader, verifikatvalidering, dokument-MIME, rapporter (råbalans, resultat, balans, moms, SKV 4700, periodrapport, kontoanalys, boksluts-förhandsvisning, grundbok, huvudbok, verifikationslista), SIE-import/export (IB/UB/RES), resultatdisposition, budget (budget vs utfall-rapport), CSV-import (parser, delimiter-detection, datum-/beloppsformatering), i18n (sv/en-ordlistor, translate, createTranslator), fakturaberäkning (radbelopp, moms, totalsummor, statusövergångsmaskin) |
| `@muninsbok/db` | 3 | 27 | Prisma→domän-mappers (organisation, räkenskapsår, konto, verifikat, verifikatrad, dokument), bankrepo-tester (connection, transaction) |
| `@muninsbok/api` | 38 | 483 | Zod-schemavalidering, CRUD-endpoints (organisationer, konton, verifikat, räkenskapsår, budgetar, kunder, fakturor), rapporter (10 st + dashboard), global sökning, boksluts-förhandsvisning, health check, Prometheus metrics, felhantering, auth (register/login/refresh/logout), httpOnly-cookie, tokenåterkallning, rollhantering, RBAC, audit-logging, rate limiting, input-sanitering, helmet, swagger, CSV-import (parse/preview/execute-endpoints), återkommande mallar (schema/due/execute-endpoints), attestflöde (regler CRUD, skicka/godkänn/avvisa), fakturering (kunder CRUD, fakturor CRUD, statusändringar), bankkoppling (CRUD, OAuth, sync, matchning, webhook), tjänster (OCR, dokumentlagring, bank-adapter/sync/matchning), receipt-OCR e2e |
| `@muninsbok/web` | 61 | 496 | ApiError-klass, fetchJson, auth-storage, dark mode (ThemeContext), verifikatformulär (beräkningar, radhantering, öre-konvertering), beloppsformatering, CSV-export, assert-utils, LocaleContext (flerspråksstöd), **komponenttester (React Testing Library)**: ThemeToggle, ConfirmDialog, DateFilter, ErrorBoundary, ReportPageTemplate, ReportSectionRows, ProtectedRoute, ToastContext, Login, NotFound, SearchDialog, CreateOrgDialog, DeleteOrgDialog, EditOrgDialog, DocumentSection, CreateFiscalYear, OrganizationSelect, **sidtester**: Dashboard, VoucherList, VoucherForm, Accounts, Reports, TrialBalance, IncomeStatement, BalanceSheet, VatReport, SkvVatDeclaration, PeriodReport, AccountAnalysis, Journal, GeneralLedger, VoucherListReport, YearEndClosing, FiscalYears, Budget, CsvImport, RecurringTemplates, Members, ApprovalRules, Customers, Invoices, InvoiceForm, InvoiceDetail, BankConnections, BankTransactions, Settings, NotFound m.fl. |

---

## Arkitektur

### Designprinciper

- **Ren domänlogik**: All bokföringslogik lever i `packages/core` utan beroenden till databas eller HTTP. Det gör den enkel att testa och resonera kring.
- **Result-typer**: Funktionell felhantering med `Result<T, E>` — aldrig exceptions för affärslogik.
- **Belopp i ören**: Alla belopp lagras som heltal (öre) för att undvika flyttalsproblem.
- **Verifikat måste balansera**: Debet = kredit, alltid.
- **DI via Fastify decorate**: API-routes injiceras med repositories via `fastify.repos`, vilket möjliggör isolerade integrationstester med mockade beroenden.
- **CSS Custom Properties**: Alla färger definieras som designtokens i `:root` med dark mode-varianter via `[data-theme="dark"]`, vilket möjliggör centraliserad temastyrning.
- **Lazy loading**: PDF-export laddas via dynamic `import()` vid klick — jsPDF+autotable (~300 KB) hämtas aldrig vid sidladdning.

### Dataflöde

```
Webbläsare (React) → REST API (Fastify) → Core-logik (validering) → Databas (Prisma/PostgreSQL)
```

### Paketberoenden

```
apps/web  →  (HTTP)  →  apps/api  →  packages/core
                                  →  packages/db  →  packages/core
```

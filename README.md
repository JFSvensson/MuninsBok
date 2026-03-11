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
- Dashboard med översikt, månadstrend och nyckeltal
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

### Import/export
- SIE4 (med IB/UB/RES)
- CSV (alla rapporter)

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
- Prometheus `/metrics`-endpoint med HTTP-statistik och Node.js runtime-metrics
- Automatisk rensning av utgångna refresh-tokens vid uppstart och schemalagt
- Strukturerad loggning med json-file-drivrutin och log-rotation
- Request-timeouts och konfigurerbar databaspool
- Swagger/OpenAPI-dokumentation

---

## Produktionsstatus

Applikationen är **produktionsklar** för självhostning av småföretag och föreningar. Följande säkerhetsmekanismer finns på plats:

- **Autentisering**: JWT med access-token i minnet, refresh-token som httpOnly-cookie, server-side återkallning (jti), automatisk token-cleanup
- **Auktorisering**: Rollbaserad behörighet (OWNER / ADMIN / MEMBER) med org-scoped membership
- **Input**: Zod-validering på alla API-endpoints, body-storleksgräns (1 MB), input-sanitering
- **Transport**: Helmet-headers, CORS-konfiguration, rate limiting med skärpt gräns på auth-endpoints
- **Infrastruktur**: Multi-stage Docker, non-root containers, healthchecks, log-rotation, graceful shutdown
- **Drift**: Request-timeouts, konfigurerbar anslutningspool, strukturerad loggning, audit trail
- **Tester**: 668 enhetstester + E2E med Playwright, CI via GitHub Actions

Se [docs/production.md](docs/production.md) för fullständig driftsättningsguide.

---

## Framtida utveckling

### Planerade förbättringar
- CD-pipeline — automatiserad deploy vid merge till main
- Frontend-komponenttester (React Testing Library)

### Framtida funktioner
- Verifikatimport från CSV/Excel (bankutdrag → verifikat)
- Återkommande verifikatmallar (automatisk månatlig bokföring)
- Dashboard-grafer med trendlinjer, årsjämförelse och prognos
- Global sökfunktion (verifikat, konton, rapporter)
- Multi-language support (engelska utöver svenska)

### Icke-mål (för närvarande)
- Bankkoppling
- Fakturering
- OCR/kvitto-tolkning
- Komplett attestflöde

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
| **Frontend** | React 19 + Vite 7 + TypeScript 5.9 |
| **Backend** | Node.js 25 + Fastify 5 + TypeScript |
| **Databas** | PostgreSQL 16+ (Prisma 7.4) |
| **Auth** | JWT (access + refresh) med jti-baserad tokenåterkallning |
| **Monorepo** | pnpm workspaces |
| **Test** | Vitest |
| **Deploy** | Docker Compose |

---

## Kom igång

### Förutsättningar

- Node.js 20+
- pnpm 9+
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

**668 enhetstester** fördelade på 56 testfiler:

| Paket | Testfiler | Tester | Vad som testas |
|-------|-----------|--------|----------------|
| `@muninsbok/core` | 19 | 286 | Result-typer, organisationsnummer (Luhn), kontotyper, kontoplan (BAS), räkenskapsår (max 18 mån), verifikatrader, verifikatvalidering, dokument-MIME, rapporter (råbalans, resultat, balans, moms, SKV 4700, periodrapport, kontoanalys, boksluts-förhandsvisning, grundbok, huvudbok, verifikationslista), SIE-import/export (IB/UB/RES), resultatdisposition, budget (budget vs utfall-rapport) |
| `@muninsbok/db` | 1 | 17 | Prisma→domän-mappers (organisation, räkenskapsår, konto, verifikat, verifikatrad, dokument) |
| `@muninsbok/api` | 27 | 285 | Zod-schemavalidering, CRUD-endpoints (organisationer, konton, verifikat, räkenskapsår, budgetar), rapporter (10 st + dashboard), boksluts-förhandsvisning, health check, Prometheus metrics, felhantering, auth (register/login/refresh/logout), httpOnly-cookie, tokenåterkallning, rollhantering, RBAC, audit-logging, rate limiting, input-sanitering, helmet, swagger |
| `@muninsbok/web` | 7 | 80 | ApiError-klass, fetchJson, auth-storage, dark mode (ThemeContext), verifikatformulär (beräkningar, radhantering, öre-konvertering), beloppsformatering, CSV-export, assert-utils |

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

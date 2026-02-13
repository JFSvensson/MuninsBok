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

## Mål (och icke-mål)

### Mål
- Bokföring via verifikat (dubbel bokföring).
- Kontoplan med BAS som standard.
- Rapporter:
  - Balansräkning
  - Resultaträkning
  - Verifikationslista
  - Provbalans (trial balance)
  - Enkel momsrapport (v1)
- Import/export:
  - SIE (mål: SIE4)
  - CSV (minst som fallback)
- Självhostbar via Docker.

### Icke-mål (i början)
- Bankkoppling
- Fakturering
- OCR/kvitto-tolkning
- Komplett attestflöde
- “Enterprise”-roller och behörigheter

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
| **Frontend** | React 18 + Vite 5 + TypeScript 5.3 |
| **Backend** | Node.js 20 + Fastify 4 + TypeScript |
| **Databas** | PostgreSQL 14+ (Prisma 5) |
| **Monorepo** | pnpm workspaces |
| **Test** | Vitest |
| **Deploy** | Docker Compose |

---

## Kom igång

### Förutsättningar

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+ (eller Docker)

### Lokal utveckling

```bash
# Klona repot
git clone https://github.com/your-username/muninsbok.git
cd muninsbok

# Installera dependencies
pnpm install

# Starta PostgreSQL (kör med Docker om du inte har lokalt)
docker compose up postgres -d

# Kopiera environment-variabler
cp .env.example .env

# Kör Prisma migrations
pnpm db:push

# Bygg core-paketet
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

**296 tester** fördelade på 21 testfiler:

| Paket | Testfiler | Tester | Vad som testas |
|-------|-----------|--------|----------------|
| `@muninsbok/core` | 12 | 176 | Result-typer, organisationsnummer (Luhn), kontotyper, kontoplan (BAS), räkenskapsår, verifikatrader, verifikatvalidering, dokument-MIME, rapporter, SIE-import/export |
| `@muninsbok/db` | 1 | 17 | Prisma→domän-mappers (organisation, räkenskapsår, konto, verifikat, verifikatrad, dokument) |
| `@muninsbok/api` | 5 | 57 | Zod-schemavalidering, CRUD-endpoints (organisationer, konton, verifikat), rapporter, health check |
| `@muninsbok/web` | 3 | 46 | ApiError-klass, fetchJson, verifikatformulär (beräkningar, radhantering, öre-konvertering), beloppsformatering |

---

## Arkitektur

### Designprinciper

- **Ren domänlogik**: All bokföringslogik lever i `packages/core` utan beroenden till databas eller HTTP. Det gör den enkel att testa och resonera kring.
- **Result-typer**: Funktionell felhantering med `Result<T, E>` — aldrig exceptions för affärslogik.
- **Belopp i ören**: Alla belopp lagras som heltal (öre) för att undvika flyttalsproblem.
- **Verifikat måste balansera**: Debet = kredit, alltid.
- **DI via Fastify decorate**: API-routes injiceras med repositories via `fastify.repos`, vilket möjliggör isolerade integrationstester med mockade beroenden.

### Dataflöde

```
Webbläsare (React) → REST API (Fastify) → Core-logik (validering) → Databas (Prisma/PostgreSQL)
```

### Paketberoenden

```
apps/web  →  (HTTP)  →  apps/api  →  packages/core
                                  →  packages/db  →  packages/core
```

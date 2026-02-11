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

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + TypeScript (Fastify)
- **DB:** PostgreSQL (Prisma)
- **Monorepo:** pnpm workspaces
- **Deploy:** Docker Compose

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
    web/                  # React UI
    api/                  # Node API server
  packages/
    core/                 # Ren bokföringslogik (ingen DB, ingen HTTP)
    db/                   # Prisma schema + migrations
    config/               # ESLint/TSConfig/Prettier
  docs/
    architecture.md
  scripts/
  docker/
  LICENSE
  README.md

# Bidra till Munins bok

Tack för att du vill bidra! Här är allt du behöver veta.

## Förutsättningar

- **Node.js** ≥ 22
- **pnpm** ≥ 8 (`corepack enable` aktiverar det)
- **PostgreSQL** 16+ (eller Docker)
- **Git**

## Kom igång

```bash
# 1. Forka och klona
git clone https://github.com/<ditt-användarnamn>/muninsbok.git
cd muninsbok

# 2. Installera beroenden
pnpm install

# 3. Starta PostgreSQL
docker compose up postgres -d

# 4. Kopiera miljövariabler
cp .env.example .env

# 5. Kör migrations
pnpm db:push

# 6. Bygg core-paketet
pnpm --filter @muninsbok/core build

# 7. Starta utvecklingsservrar
pnpm dev
```

Frontend: http://localhost:5173
API: http://localhost:3000
Swagger-dokument: http://localhost:3000/docs

## Projektstruktur

```
muninsbok/
  apps/
    api/      # REST API (Fastify + Zod)
    web/      # React SPA (Vite + React Router)
  packages/
    core/     # Ren bokföringslogik (inga beroenden till DB/HTTP)
    db/       # Prisma schema + repositories + mappers
```

### Banking-modulen

- API-routes: `apps/api/src/routes/bank.ts`
- Matchningslogik: `apps/api/src/services/bank-matching.ts`
- Synklogik: `apps/api/src/services/bank-sync.ts`
- Scheman/validering: `apps/api/src/schemas/bank.ts`
- Web-vyer: `apps/web/src/pages/BankConnections.tsx` och `apps/web/src/pages/BankTransactions.tsx`
- i18n-nycklar: `packages/core/src/i18n.ts` (prefix `bank.`)

Feature-gating for banking styrs med `BANK_ENABLED_ORG_IDS` (backend) och `VITE_BANK_ENABLED_ORG_IDS` (frontend).
Använd samma värde i båda för att undvika att UI visar funktioner som API:t nekar.

### Designprinciper

- **Ren domänlogik** — all bokföringslogik i `packages/core` utan sidoeffekter.
- **Result-typer** — funktionell felhantering med `Result<T, E>`, inga exceptions för affärslogik.
- **Belopp i ören** — alla belopp lagras som heltal (öre) för att undvika flyttalsproblem.
- **DI med interfaces** — API-routes injiceras med repositories via `fastify.repos`.

## Kodstil

- **TypeScript strict mode** — inga `any` utan eslint-disable-kommentar.
- **Formatering**: Prettier (körs automatiskt via pre-commit hook).
- **Linting**: ESLint med typescript-eslint.

Pre-commit hooks med husky + lint-staged körs automatiskt vid `git commit`.

## Tester

```bash
# Kör alla tester
pnpm test

# Enskilt paket
pnpm --filter @muninsbok/core test
pnpm --filter @muninsbok/api test
pnpm --filter @muninsbok/web test

# Med coverage
pnpm test:coverage
```

### Testprinciper

- Lägg enhetstester bredvid källfilen: `foo.ts` → `foo.test.ts`.
- API-tester använder mockade repositories via `buildTestApp()`.
- Sträva efter att täcka alla nya funktioner med tester.

## Databasändringar

```bash
# Redigera schemat
# packages/db/prisma/schema.prisma

# Generera ny migration
pnpm --filter @muninsbok/db exec prisma migrate dev --name beskrivning

# Generera Prisma-klient
pnpm db:generate
```

## Git-arbetsflöde

1. Skapa en feature-branch: `git checkout -b feat/min-ändring`
2. Commita med beskrivande meddelanden (svenska eller engelska).
3. Se till att `pnpm test` och `pnpm lint` passerar.
4. Öppna en Pull Request mot `main`.

## Rapportera buggar

Öppna en issue och inkludera:
- Vad du förväntade dig
- Vad som hände
- Steg för att reproducera

## Licens

Genom att bidra godkänner du att ditt bidrag licensieras under **AGPLv3** (samma som projektet).

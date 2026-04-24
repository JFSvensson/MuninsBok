# Driftsättning i produktion

Denna guide beskriver hur du kör Munins bok i en produktionsmiljö med TLS, backup, övervakning och säkerhet.

---

## Innehåll

1. [Förberedelser](#förberedelser)
2. [Miljövariabler](#miljövariabler)
3. [TLS / HTTPS med nginx](#tls--https-med-nginx)
4. [Backup & återställning](#backup--återställning)
5. [Övervakning](#övervakning)
6. [Säkerhetsrekommendationer](#säkerhetsrekommendationer)
7. [CD-pipeline](#cd-pipeline)
8. [Databasmigreringar](#databasmigreringar)

---

## Förberedelser

- **Node.js 22+** och **pnpm 8+** (om du kör utan Docker)
- **PostgreSQL 16+** med ett dedikerat databasanvändarkonto
- **Docker & Docker Compose** (rekommenderat)
- Eget domännamn med DNS pekat mot servern
- TLS-certifikat (Let's Encrypt / Certbot rekommenderas)

---

## Miljövariabler

Skapa `.env` baserad på `.env.example`:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://user:lösenord@localhost:5432/muninsbok
HOST=0.0.0.0
PORT=3000
CORS_ORIGIN=https://din-domän.se
JWT_SECRET=en-lång-slumpmässig-hemlighet
```

Generera `JWT_SECRET` med:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Viktiga inställningar i produktion

| Variabel | Krävs | Beskrivning |
|----------|-------|-------------|
| `NODE_ENV` | Nej (default: `development`) | Sätts till `production` — styr loggformat och varningar |
| `DATABASE_URL` | **Ja** | PostgreSQL-anslutningssträng |
| `JWT_SECRET` | **Ja (produktion)** | Aktiverar JWT-autentisering (register/login). **API:et startar inte utan denna i produktion.** |
| `CORS_ORIGIN` | **Ja (produktion)** | Frontend-URL (t.ex. `https://bok.example.se`). **API:et startar inte utan denna i produktion.** |
| `HOST` | Nej (default: `0.0.0.0`) | Lyssningsadress |
| `PORT` | Nej (default: `3000`) | Lyssningsport |
| `DATABASE_POOL_SIZE` | Nej (default: `20`) | Max antal databasanslutningar i poolen |
| `ENABLE_DOCS` | Nej (default: `false` i produktion) | Exponerar Swagger UI på `/docs`. Rekommenderas endast i dev/staging eller bakom separat skydd. |
| `METRICS_TOKEN` | Nej | Om satt registreras `/metrics` och kräver `Authorization: Bearer <token>`. Utan denna exponeras inte `/metrics` i produktion. |
| `OCR_ENABLE_PDF` | Nej (default: `false`) | Aktiverar lokal PDF→bild-konvertering för OCR (kräver `pdftoppm`/Poppler i runtime) |
| `BANK_WEBHOOK_HMAC_SECRET` | Rekommenderat | Global HMAC-hemlighet for bank-webhooks (`x-webhook-signature`) |
| `BANK_WEBHOOK_<PROVIDER>_HMAC_SECRET` | Nej | Providerspecifik HMAC-hemlighet som prioriteras over global hemlighet |
| `BANK_ENABLED_ORG_IDS` | Nej | Backend feature-gate för banking per organisation: tom/ej satt = alla, `*` = alla, annars kommaseparerad lista av org-id |
| `BANK_OAUTH_REDIRECT_URI_ALLOWLIST` | Rekommenderat i produktion | Exakt kommaseparerad allowlist för tillåtna bank OAuth-callback-URL:er. Om den inte sätts används lokala dev-URL:er samt `CORS_ORIGIN + /bank/callback` när `CORS_ORIGIN` finns. |
| `VITE_BANK_ENABLED_ORG_IDS` | Nej | Frontend feature-gate med samma syntax som backend; bör spegla `BANK_ENABLED_ORG_IDS` |

Servern validerar vid start att `DATABASE_URL` finns — saknas den avslutas processen direkt med felmeddelande.
I produktion krävs både `JWT_SECRET` och `CORS_ORIGIN`.

### Introspektionsytor i produktion

- `/docs` är avstängd som standard i produktion och exponeras endast om `ENABLE_DOCS=true` är satt.
- `/metrics` registreras endast i produktion om `METRICS_TOKEN` är satt, och kräver då `Authorization: Bearer <token>`.
- Rekommendation: håll både `/docs` och `/metrics` bakom reverse proxy, intern nätverksyta eller separat auth även när de är aktiverade.

### Bank-webhooks: signaturverifiering

For inkommande bank-webhooks kan API:t verifiera HMAC-signatur automatiskt.

- Header: `x-webhook-signature`
- Stodda format:
  - `sha256=<hex>`
  - `<hex>`
- Hash-algoritm: `HMAC-SHA256`

Konfiguration:

- `BANK_WEBHOOK_HMAC_SECRET` anvands som global fallback
- `BANK_WEBHOOK_<PROVIDER>_HMAC_SECRET` (t.ex. `BANK_WEBHOOK_SANDBOX_HMAC_SECRET`) anvands i forsta hand

Om en hemlighet ar konfigurerad maste webhooken innehalla giltig signatur, annars returnerar API:t:

- `400 BANK_WEBHOOK_SIGNATURE_MISSING` nar header saknas
- `400 BANK_WEBHOOK_SIGNATURE_INVALID` nar signaturen ar felaktig

Exempel:

```dotenv
# Global fallback
BANK_WEBHOOK_HMAC_SECRET=byt-till-lang-slumpmassig-hemlighet

# Providerspecifik hemlighet (overskriver global for provider "sandbox")
BANK_WEBHOOK_SANDBOX_HMAC_SECRET=annan-hemlighet-for-sandbox
```

### Bank OAuth-callbacks

För bankanslutningar verifierar API:t en signerad OAuth-`state` server-side och accepterar endast callback-URL:er från en explicit allowlist.

Rekommenderad produktionsexempel:

```dotenv
BANK_OAUTH_REDIRECT_URI_ALLOWLIST=https://bok.example.se/bank/callback
```

Regler:

- Matchningen är exakt efter normaliserad URL.
- Om variabeln inte är satt används endast lokala utvecklings-URL:er (`http://127.0.0.1:5173/bank/callback`, `http://localhost:5173/bank/callback`) samt `CORS_ORIGIN + /bank/callback` när `CORS_ORIGIN` finns.
- Lägg till alla legitima callback-URL:er uttryckligen vid flera domäner eller stagingmiljöer.

### Operativ checklista: rotation av webhook-hemligheter

Nar ni roterar hemligheter i produktion, anvand denna ordning for att undvika avbrott:

1. Skapa ny hemlighet i webhook-provider/aggregator.
2. Uppdatera servermiljon med ny variabel (`BANK_WEBHOOK_<PROVIDER>_HMAC_SECRET` rekommenderas).
3. Rulla ut API-instansen och verifiera att inkommande webhooks fortsatt returnerar 2xx.
4. Overvaka loggar for koderna `BANK_WEBHOOK_SIGNATURE_MISSING` och `BANK_WEBHOOK_SIGNATURE_INVALID`.
5. Nar trafiken ar stabil, ta bort gammal hemlighet hos provider och i deployment-hemligheter.

Tips:

- Behall global fallback (`BANK_WEBHOOK_HMAC_SECRET`) endast om ni verkligen behover den.
- Providerspecifika hemligheter ar tydligare och minskar blast radius vid hemlighetslage.

### Banking feature-gating i produktion

Använd org-scope-gating för att rulla ut banking stegvis:

```dotenv
# Backend (API-access till /bank-endpoints)
BANK_ENABLED_ORG_IDS=org-123,org-456

# Frontend (navigation/routes i web)
VITE_BANK_ENABLED_ORG_IDS=org-123,org-456
```

Regler:

- Tom/ej satt variabel: banking är aktiverat för alla organisationer.
- `*`: explicit aktiverat för alla organisationer.
- Komma-separerad lista: endast angivna organisationer.

Rekommendation: håll frontend- och backend-variabler synkade för att undvika att UI visar funktioner som API nekar.

---

## Felsökning: API-container och kodmismatch

Om API:t returnerar `404 Route not found` för endpoints som finns i källkoden, kör containern sannolikt en **gammal Docker-image**.

**Diagnostisera:**

```bash
# Se containerålder
docker compose ps

# Kontrollera att rätt routes laddas
docker logs --tail 50 muninsbok-api | grep -i "route\|listen\|error"
```

**Åtgärda:**

```bash
# Bygg om utan cache och starta
docker compose build --no-cache api
docker compose up -d api

# Vänta på healthcheck och verifiera
docker compose ps
curl http://localhost:3000/health
```

**Rutin vid deploy:** Inkludera alltid `docker compose build` i deploy-flödet. CI/CD-pipelinen bör använda `--no-cache` eller bygga med unik tag för att undvika stale images.

---

## TLS / HTTPS med nginx

I produktion ska all trafik gå via HTTPS. Lägg en **nginx reverse proxy** framför Docker-stacken.

### 1. Installera Certbot & hämta certifikat

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bok.example.se
```

### 2. nginx-konfiguration

Spara som `/etc/nginx/sites-available/muninsbok`:

```nginx
# Omdirigera HTTP → HTTPS
server {
    listen 80;
    server_name bok.example.se;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bok.example.se;

    ssl_certificate     /etc/letsencrypt/live/bok.example.se/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bok.example.se/privkey.pem;

    # Säkerhetshuvuden
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend (statiska filer)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Filuppladdning — höj gräns vid behov
        client_max_body_size 10m;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 3. Aktivera och testa

```bash
sudo ln -s /etc/nginx/sites-available/muninsbok /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Automatisk certifikatsförnyelse

Certbot installerar en timer automatiskt. Verifiera:

```bash
sudo systemctl status certbot.timer
```

---

## Backup & återställning

### Daglig backup med pg_dump

Skapa ett skript `/opt/muninsbok/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/muninsbok/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/muninsbok_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Om PostgreSQL körs i Docker:
docker exec muninsbok-db pg_dump -U muninsbok muninsbok | gzip > "$BACKUP_FILE"

# Om PostgreSQL körs lokalt:
# pg_dump -U muninsbok muninsbok | gzip > "$BACKUP_FILE"

# Ta bort gamla backuper
find "$BACKUP_DIR" -name "muninsbok_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup klar: ${BACKUP_FILE}"
```

Gör skriptet körbart och lägg in som cron-jobb:

```bash
chmod +x /opt/muninsbok/backup.sh

# Daglig backup kl 02:00
echo "0 2 * * * root /opt/muninsbok/backup.sh >> /var/log/muninsbok-backup.log 2>&1" \
  | sudo tee /etc/cron.d/muninsbok-backup
```

### Återställning

```bash
# Stoppa API:t
docker compose stop api

# Återställ dump
gunzip -c /opt/muninsbok/backups/muninsbok_20260101_020000.sql.gz \
  | docker exec -i muninsbok-db psql -U muninsbok muninsbok

# Starta API:t igen
docker compose start api
```

### Backup av uppladdade dokument

Bifogade filer lagras i Docker-volymen `uploads_data`. Säkerhetskopiera den också:

```bash
# Kopiera volymen
docker run --rm -v muninsbok_uploads_data:/data -v /opt/muninsbok/backups:/backup \
  alpine tar czf /backup/uploads_${TIMESTAMP}.tar.gz -C /data .
```

### Testa backup regelbundet

> **Viktig princip**: En backup som inte har testats är ingen backup.

Återställ till en testdatabas regelbundet för att verifiera att backupen fungerar:

```bash
# Skapa test-DB och återställ
docker exec muninsbok-db createdb -U muninsbok muninsbok_test
gunzip -c backup.sql.gz | docker exec -i muninsbok-db psql -U muninsbok muninsbok_test

# Verifiera
docker exec muninsbok-db psql -U muninsbok muninsbok_test -c "SELECT count(*) FROM vouchers;"

# Rensa
docker exec muninsbok-db dropdb -U muninsbok muninsbok_test
```

---

## Övervakning

### Health check

API:et exponerar `/health` som returnerar:

```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-02-18T12:00:00.000Z"
}
```

Om databasen inte svarar returneras `"status": "degraded"`.

### Extern övervakning (exempel med curl)

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://bok.example.se/health)
if [ "$RESPONSE" != "200" ]; then
  echo "ALARM: Munins bok health check misslyckades (HTTP $RESPONSE)" | \
    mail -s "Muninsbok-larm" admin@example.se
fi
```

### Docker-loggar

```bash
# Följ API-loggar i realtid
docker compose logs -f api

# Senaste 100 raderna
docker compose logs --tail 100 api
```

---

## Säkerhetsrekommendationer

1. **Sätt alltid `JWT_SECRET`** i produktion — utan den startar inte API:t.
2. **Använd starka databaslösenord** — inte standardvärdet `muninsbok`.
3. **Begränsa nätverksåtkomst** — PostgreSQL ska bara vara tillgänglig från API-containern, aldrig publikt.
4. **Kör databasbackup dagligen** och testa återställning regelbundet.
5. **Uppdatera Docker-images regelbundet** — kör `docker compose pull && docker compose up -d`.
6. **Håll `NODE_ENV=production`** — det styr loggformat och kan i framtiden påverka prestanda.
7. **Aktivera brandväggsregler** — bara port 80/443 ska vara öppna publikt.

### docker-compose.override.yml (produktion)

Skapa för att anpassa produktionsinställningar:

```yaml
version: "3.8"
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ett-starkt-slumpmässigt-lösenord
    # Stäng extern port i produktion
    ports: !reset []

  api:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://muninsbok:ett-starkt-slumpmässigt-lösenord@postgres:5432/muninsbok
      JWT_SECRET: generera-en-64-bytes-hemlighet
      CORS_ORIGIN: https://bok.example.se
    restart: always
```

---

## CD-pipeline

Repot har en GitHub Actions-workflow (`.github/workflows/cd.yml`) som automatiskt bygger och deployar vid lyckad CI på `main`.

### Flöde

1. **CI passerar** — alla tester, lint och typecheck gröna på `main`
2. **Docker-images byggs** — `muninsbok-api` och `muninsbok-web` byggs med multi-stage Dockerfiles
3. **Push till GHCR** — images pushas till GitHub Container Registry med commit-hash som tag + `latest`
4. **SSH-deploy** — images pullas på produktionsservern, taggas som `current`, containers startas om med health check-verifiering

### Förutsättningar på servern

1. Docker & Docker Compose installerat
2. SSH-åtkomst med nyckelbaserad autentisering
3. `docker-compose.yml` + `docker-compose.prod.yml` + `.env.docker` i deploy-mappen
4. Användaren måste kunna köra `docker` utan sudo (lägg till i `docker`-gruppen)
5. Servern måste kunna nå `ghcr.io` — logga in en gång:

```bash
echo $GITHUB_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

### GitHub Secrets

Konfigurera dessa under **Settings → Environments → production → Secrets**:

| Secret | Beskrivning |
|--------|-------------|
| `DEPLOY_HOST` | Serverns IP eller hostname |
| `DEPLOY_USER` | SSH-användare (t.ex. `deploy`) |
| `DEPLOY_SSH_KEY` | Privat SSH-nyckel (ed25519 rekommenderas) |
| `DEPLOY_PATH` | Sökväg till deploy-mappen (default: `~/muninsbok`) |

### Första installationen

```bash
# På servern
mkdir -p ~/muninsbok
cd ~/muninsbok

# Kopiera filer från repot
scp docker-compose.yml docker-compose.prod.yml .env.docker.example server:~/muninsbok/

# Konfigurera secrets
cp .env.docker.example .env.docker
nano .env.docker  # fyll i lösenord och JWT_SECRET

# Logga in mot GHCR
echo $GITHUB_PAT | docker login ghcr.io -u USERNAME --password-stdin

# Starta med prod-override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Manuell deploy

Om du behöver deploya utan att gå via CI:

```bash
cd ~/muninsbok
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull api web
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web
```

### Rollback

```bash
# Lista tillgängliga tags
docker image ls ghcr.io/jfsvensson/muninsbok-api

# Tagga en äldre version som current
docker tag ghcr.io/jfsvensson/muninsbok-api:sha-abc1234 ghcr.io/jfsvensson/muninsbok-api:current
docker tag ghcr.io/jfsvensson/muninsbok-web:sha-abc1234 ghcr.io/jfsvensson/muninsbok-web:current

# Starta om
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web
```

---

## Databasmigreringar

Projektet använder **Prisma** för databasschema. Det finns två kommandon som hanterar schemaändringar — de används i olika sammanhang:

| Kommando | Miljö | Beskrivning |
|----------|-------|-------------|
| `prisma db push` | **Utveckling** | Synkroniserar schemat direkt utan att skapa migreringsfiler. Snabbt och enkelt under utveckling. |
| `prisma migrate deploy` | **Produktion** | Kör alla väntande migreringsfiler i ordning. Säkert och repeterbart. |

### Workflow: skapa en ny migrering

1. **Ändra schemat** i `packages/db/prisma/schema.prisma`

2. **Skapa migreringsfil:**

   ```bash
   pnpm --filter @muninsbok/db exec prisma migrate dev --name beskrivande-namn
   ```

   Detta skapar en SQL-fil under `packages/db/prisma/migrations/` och uppdaterar den lokala databasen.

3. **Committa** migreringsfilen tillsammans med schemaändringen.

4. **Vid deploy** körs migreringar automatiskt — API-containerns CMD kör `prisma migrate deploy` innan servern startar (se `apps/api/Dockerfile`).

### Viktigt

- Kör **aldrig** `prisma db push` mot produktionsdatabasen — den kan förstöra data vid destruktiva ändringar.
- Testa migreringar lokalt med `prisma migrate dev` innan deploy.
- Ta alltid backup före migrering i produktion (se [Backup & återställning](#backup--återställning)).

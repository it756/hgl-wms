# Harvest WMS — Warehouse Management System

A Next.js 16 web application for managing inter-SBU goods transfers, warehouse issuances, GRN processing, and supplier GRN stock receipt for Harvest Glory Limited.

---

## Roles

| Role                | Capabilities                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `ADMIN`             | Full access: manage users, SBUs, products, settings, exports, variance resolution |
| `BU_MANAGER`        | Raise and track transfer requests for their SBU                                   |
| `WAREHOUSE_MANAGER` | Process issuances, record supplier GRNs, view variance queue                      |
| `UNIT_STAFF`        | Receive goods and submit GRNs against issued transfers                            |
| `FINANCE_MANAGER`   | Approve/reject high-value transfer requests and supplier GRNs                     |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (Postgres + Auth)
- **Email**: Nodemailer (SMTP)
- **Testing**: Vitest 4 + @testing-library/react
- **Styling**: Tailwind CSS v4
- **CI**: GitHub Actions
- **Deployment**: Railway

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=        # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (server-only)
SMTP_HOST=                       # SMTP server hostname
SMTP_PORT=587                    # SMTP port (usually 587 for TLS)
SMTP_USER=                       # SMTP username / email address
SMTP_PASS=                       # SMTP password or app password
SMTP_FROM=                       # From address for outgoing emails

## Email retry configuration

The application includes a centralized email sending helper with configurable retry/backoff behaviour. Configure the behaviour with the following environment variables:

- `EMAIL_MAX_RETRIES` (default: `5`): Maximum number of send attempts before the message is recorded as a dead-letter.
- `EMAIL_BASE_DELAY_MS` (default: `200`): Base delay (in milliseconds) used for exponential backoff between retries.
- `EMAIL_MAX_DELAY_MS` (default: `10000`): Maximum backoff delay (in milliseconds).
- `EMAIL_USE_JITTER` (default: `true`): When `true`, applies full jitter (random delay between `0` and the exponential delay) to reduce retry collisions.

Behaviour notes:
- The send helper uses exponential backoff with full jitter by default. For attempt N the exponential delay is approximately `min(EMAIL_MAX_DELAY_MS, EMAIL_BASE_DELAY_MS * 2^N)`; the actual wait when jitter is enabled is a random value between `0` and that delay.
- Transient network/server errors are retried. Permanent client errors (SMTP 4xx/5xx response classification is used conservatively) are recorded as dead-letters and not retried further.
- Dead-letter records are written to the `audit_logs` table as an `email_dead_letter` action (best-effort). If you prefer a dedicated table, add an `email_dead_letters` migration and update the recorder accordingly.

Example .env snippet:

```

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=example-user
SMTP_PASS=secret
EMAIL_FROM=no-reply@example.com

EMAIL_MAX_RETRIES=5
EMAIL_BASE_DELAY_MS=200
EMAIL_MAX_DELAY_MS=10000
EMAIL_USE_JITTER=true

```

If you need stricter delivery guarantees, consider offloading sends to a dedicated queue (Redis/Bull or cloud tasks) and letting a worker manage retries and rate limiting.
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

In the Supabase dashboard or via the Supabase CLI, run migrations in order:

```bash
supabase db push
# or apply manually:
# supabase/migrations/000_initial_schema.sql
# supabase/migrations/001_decrement_stock.sql
# supabase/migrations/002_process_issuance.sql
# supabase/migrations/003_increment_stock_after_grn.sql
# supabase/migrations/004_decrement_stock_batch.sql
```

### 3. Seed initial data (optional)

```bash
npx tsx scripts/seed/seed_data.ts
```

Creates 4 SBUs, 6 products, and an admin user.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start development server                 |
| `npm run build`         | Production build                         |
| `npm run start`         | Start production server                  |
| `npm run lint`          | ESLint                                   |
| `npm run format`        | Prettier format (write)                  |
| `npm run format:check`  | Prettier format (check only, used in CI) |
| `npm test`              | Run tests once                           |
| `npm run test:watch`    | Vitest watch mode                        |
| `npm run test:coverage` | Coverage report (v8)                     |

---

## Project Structure

```
app/                    Next.js App Router pages and API routes
  api/                  REST API routes
    admin/              Admin CRUD endpoints (users, SBUs, products, settings, variance)
    auth/               Auth helpers (register, reset-password, deactivate)
    audit/              Audit log query endpoint
    exports/            CSV export endpoints
    finance/            Finance approval queue
    grns/               GRN submission
    issuances/          Goods issuance
    supplier-grns/      Supplier GRN management
    transfer-requests/  Transfer request CRUD
  admin/                Admin UI pages
  finance/              Finance Manager UI
  grn/                  Unit Staff GRN submission UI
  requests/             BU Manager transfer request UI
  warehouse/            Warehouse Manager UI

lib/
  models/               TypeScript interfaces for all entities
  services/             Business logic (transfer, issuance, GRN, audit, notifications)
  email/templates/      Email HTML templates
  rbac.ts               Role-based access control helpers
  supabaseServer.ts     Supabase admin client + auth helper

supabase/migrations/    SQL migration files
tests/
  integration/          Integration tests (mocked Supabase)
  unit/                 Unit tests for services and helpers
scripts/seed/           Database seed script
```

---

## Authentication

All API routes expect a `Bearer <access_token>` header. The token is the Supabase JWT obtained from `supabase.auth.signInWithPassword(...)`. Frontend pages read it from `localStorage.getItem("access_token")`.

---

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:

1. `npm run lint`
2. `npm run format:check`
3. `npm test`
4. `npm run build`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# CRM for Exchanger

Operational CRM for currency exchange offices: cash desks, daily trade journal, counterparties, debts, expenses, and day-close P/L in USD.

This repository is a **product showcase**. UI, configuration, and the Prisma schema are public. Server-side mutations, aggregation queries, and monetary calculation modules are not included here.

---

## What it does

Cashiers record multi-currency positions during the day (what left a till vs what came in). The system keeps live wallet balances, optional client debts, an immutable-enough operations history, and a day-close that compares theoretical vs actual USD inventory.

The product is built for a **single organization with multiple branches** (points of exchange), not a multi-tenant SaaS.

### Core workflows

| Area | Purpose |
| --- | --- |
| Setup wizard | First-run: admin account → branches → wallets → directories → go live |
| Work / Journal | Fast daily board of multi-leg positions per branch and date |
| Dashboard | USD P/L over selectable ranges (closed days vs live trades) |
| Day summary | Inventory rates, theoretical vs actual close, freeze snapshots |
| History | Posted operations: edit, archive, delete with balance impact preview |
| Debts | Who owes whom, in which wallet currency, including cross-currency repay |
| Expenses | Categorized cash outflows |
| Wallets | Tills per branch + currency, colors, opening adjustments |
| Counterparties | Clients, including temporary cards created from the journal |
| Settings | Users, permission presets, directories, audit log |
| Notifications | In-app unread indicators |

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript (strict) |
| UI | Tailwind CSS 4, Phosphor Icons, Geist / Geist Mono |
| Data | PostgreSQL 16, Prisma 6 |
| Auth | Cookie sessions, bcrypt password hashes |
| Deploy | Docker (standalone Next.js), Compose, optional Caddy + Let's Encrypt |

Mutations run as **Next.js Server Actions**. There is no public REST/GraphQL API besides a database health check. Pages that show live balances are dynamically rendered.

---

## Domain model (high level)

All operational context is scoped to the **current branch** (cookie-selected).

- **Branch** — exchange point
- **Wallet** — till: branch + currency + running balance (`Decimal`)
- **Currency** — directory (defaults include UAH, USD, EUR, PLN, USDT)
- **Counterparty** — client; may start as a temporary card
- **Journal position** — UX row for the day: `out` / `in` lines, optional cross-rates, optional P/L override
- **Operation + legs** — posted ledger entry with signed amounts and **frozen** per-leg USD rates
- **Debt / repayment** — remaining amount in a wallet currency
- **Day opening / day rates / day summary** — open, revalue, close; close stores rate and balance snapshots
- **User, session, permission** — RBAC
- **Audit log / notifications** — who did what; in-app alerts

### Operation types

Buy, sell, lend, repay, recolor (same-currency till move), expense, adjustment, exchange, cash in/out, balance transfer.

### Money convention (public)

The books are **USD-anchored**:

- Rate = units of wallet currency per **1 USD** (USD wallets use `1`).
- Notional USD uses fixed decimal scale; rates use a finer scale.
- Position P/L is conceptually **Σ USD(in) − Σ USD(out)** unless a confirmed manual override is stored.
- Historical legs keep the rate used at save time so later market moves do not rewrite the past.

Exact derivation of missing rates, rounding policy, and close-day formulas live in private modules and are omitted here.

---

## Access control

Authentication: login + password. The session token is stored in an **httpOnly** cookie; only a hash is persisted. `Secure` depends on environment (`COOKIE_SECURE` / HTTPS) so HTTP-on-IP VPS logins still work until TLS is enabled.

Nine permission codes (examples): view operations, view wallets, create/edit operations, archive, delete, edit opening balances, manage directories, manage users, view audit.

Path and nav visibility are gated (OR of required codes). After login, users land on the first route they are allowed to see.

Presets: **Cashier**, **Owner**, **Admin**.

Middleware only checks that a session cookie exists. Authorization is enforced in layouts and on the server for every mutation.

---

## Architecture (what this repo shows)

```text
Browser
  ├─ UI: components/, App Router pages
  ├─ Theme: light/dark, no FOUC
  └─ Cookies: session + current branch
        │
Next.js (this app)
  ├─ Public in this repo: routes, layout, Prisma schema, Docker
  └─ Private: Server Actions, data loaders, money engine
        │
PostgreSQL
```

UI lists use client-side search, sort, and pagination suitable for a cashier’s daily volume—not warehouse-scale analytics.

---

## Repository layout

```text
app/                 Routes (login, work, history, settings, health)
components/          UI by domain
prisma/schema.prisma Canonical data model
docker-compose.yml   db + migrate + app
Dockerfile           Multi-stage standalone image
```

Intentionally unpublished (commercial logic):

- `lib/actions/` — Server Actions
- `lib/money/` — FX / P/L / day-close calculations
- `lib/data/` — server aggregations
- Prisma seed with demo volumes

The schema is still the source of truth for entities, indexes, and decimal columns.

---

## Local development (full private tree)

Requires Node 20+, Docker for Postgres, and a `.env` copied from `.env.example`.

```bash
cp .env.example .env
npm install
npm run db:up
npx prisma migrate deploy
npx prisma db seed   # optional demo data; change seed admin password
npm run dev
```

Open the printed localhost / LAN URL, then `/login`. An empty database presents the setup wizard instead of the login form.

Useful scripts: `db:migrate`, `db:studio`, `db:reset`. Dev binds `0.0.0.0` so a phone on the same LAN can hit the app.

---

## Production (Docker)

Compose order: **Postgres (healthcheck) → `prisma migrate deploy` → app**.

The app image is Next.js `output: "standalone"`. Postgres is published on **localhost only**. Optional second compose file terminates TLS with Caddy.

Environment (never commit real values):

| Variable | Role |
| --- | --- |
| `POSTGRES_*` | Database user, password, name, host port |
| `DATABASE_URL` | Prisma connection (local tools); Compose builds this for containers |
| `COOKIE_SECURE` | `false` on HTTP; `true` behind HTTPS |
| `APP_URL` | Public origin when using TLS |
| `SESSION_COOKIE_NAME` | Session cookie name |
| `DOMAIN` | Hostname for Caddy |

VPS helpers in `scripts/` install, update, wipe data, and enable HTTPS. After DNS A records point at the server, traffic is `https://<domain>/login`.

Health: `GET /api/health/db` — connectivity plus coarse table counts (no business payloads).

---

## Security notes

- Passwords hashed with bcrypt.
- Session token never stored in plaintext.
- Branch and wallet deletes are restricted where history exists; destructive actions use preview + confirmation where the UI exposes them.
- Audit records actor, action, entity, optional before/after metadata.
- This is an **internal ops tool**: no OAuth, 2FA, or SSO in the current product.

Do not commit `.env`. Rotate `SEED_ADMIN_*` immediately after first login on any shared machine.

---

## What this showcase is not

- Not a public banking API
- Not double-entry general ledger software
- Not multi-organization SaaS isolation
- Not a substitute for licensed accounting in your jurisdiction

---

## License / status

Private commercial product. Source in this GitHub view is limited to UI, infrastructure, and schema for portfolio review. Runtime behavior of posting, P/L, and day-close requires the private modules.

---

## Author

Built as a full-stack operations system: domain model, cashier UX, RBAC, and Docker/VPS delivery. Implementation assisted in **Cursor** (project rules for Next.js 16, UI skill for the interface)—domain decisions, schema, and production constraints remain owned by the author.

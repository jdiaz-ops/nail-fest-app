# Deploy to production (Vercel + Neon)

This session can't reach `vercel.com` or `console.neon.tech` directly (network
policy on this environment) — so this part happens from your own browser,
not from here. Everything the deploy needs is already in the repo; this is
just where to click.

## 1. Import the repo into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   pick `jdiaz-ops/nail-fest-app`.
2. Framework preset: Next.js (auto-detected). Leave build settings as-is —
   `vercel.json` already overrides the build command to run
   `prisma migrate deploy` before `next build`, so your database schema
   applies automatically on every deploy, no manual migration step.

## 2. Environment variables

In the Vercel project → **Settings → Environment Variables**, add these
(get the two `DATABASE_URL*` values from Neon's **Connect** modal — see
below):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string **with** connection pooling toggled on (host ends in `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Same modal, pooling toggled **off** |
| `APP_SECRET_KEY` | Output of `openssl rand -hex 32` — run it once locally, paste the result |
| `APP_BASE_URL` | Your Vercel deployment URL (e.g. `https://nail-fest-app.vercel.app`), update if you add a custom domain later |
| `DEFAULT_CURRENCY` | `COP` |
| `META_PURCHASE_PLACEHOLDER_VALUE` | `1` (placeholder — see the Meta brief discussion) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Whatever you want — gates `/admin/*` |
| `INTERNAL_CRON_SECRET` | Any random string — gates `/api/meta/retry` and the one-time seed endpoint below |

Meta (`META_*`) and SES (`AWS_*`, `SES_*`) vars can stay empty for this
first deploy — the app degrades gracefully without them (registration still
works; it just skips the QR email and the Meta events, logging the failure
instead of breaking). Add them once you've done `docs/META_SETUP.md` and
`docs/SES_SETUP.md`.

## 3. Deploy

Click **Deploy**. Vercel builds, runs the migration against your Neon
database, and gives you a live URL.

## 4. Seed the baseline data (once)

This session can't run `npm run db:seed` against your production database
either, so there's a one-time endpoint for it instead:

```bash
curl -X POST https://<your-deployment-url>/api/admin/seed \
  -H "x-cron-secret: <your INTERNAL_CRON_SECRET value>"
```

Safe to call more than once — every write is an upsert. After this,
`https://<your-deployment-url>/bogota-2026` has the seeded test event live.

## 5. Verify

- Visit `/bogota-2026` — the landing/registration form should load.
- Register with a real email.
- Visit `/admin/registrations` — browser will prompt for the
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` you set — the registration should show
  up there.
- (Optional, once SES is production-approved) confirm the QR email arrives.
- (Optional, once Meta is configured) confirm events land in Meta Events
  Manager's Test Events tab.

## Ongoing: the Meta retry cron

`/api/meta/retry` needs to be hit on a schedule (every ~5 minutes) to retry
failed Meta sends with backoff. Vercel Cron Jobs (Settings → Cron Jobs) is
the simplest way — point one at `POST /api/meta/retry` with header
`x-cron-secret: <INTERNAL_CRON_SECRET>` on that interval.

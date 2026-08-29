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
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Whatever you want — used ONCE, by step 4 below, to create your first real admin login. Not checked on every request the way it used to be (see the real login system in `/admin/settings/users`) — safe to leave set afterward. |
| `INTERNAL_CRON_SECRET` | Any random string — gates the cron routes (manual `curl` testing) and the one-time seed endpoint below |
| `CRON_SECRET` | Same value as `INTERNAL_CRON_SECRET` (simplest) — Vercel auto-attaches this as a Bearer token when it triggers the crons declared in `vercel.json`, see below |

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

## 4b. Create your first admin login (once)

The app has real per-person accounts now (`/admin/settings/users` — admin
and staff roles), not a single shared password. This turns the
`ADMIN_USERNAME`/`ADMIN_PASSWORD` you set above into that first real
account, so you have a way in:

```bash
curl -X POST https://<your-deployment-url>/api/admin/bootstrap-admin \
  -H "x-cron-secret: <your INTERNAL_CRON_SECRET value>"
```

Safe to call more than once — it never touches an account that already
exists under that username, so re-running it after you've changed your
password from `/admin/settings/users` won't reset it back.

## 5. Verify

- Visit `/bogota-2026` — the landing/registration form should load.
- Register with a real email.
- Visit `/login`, sign in with the account from step 4b — you land on
  `/admin`. From `/admin/crm/registrations` the registration from the step
  above should show up.
- From `/admin/settings/users`, create a real STAFF account for each door
  person — they log in at `/login` too, and land straight on `/admin/scan`
  (event picker + scanner, nothing else). `/admin/scan` itself has a
  "Descargar la app" QR they can scan with their own phone.
- (Optional, once SES is production-approved) confirm the QR email arrives.
- (Optional, once Meta is configured) confirm events land in Meta Events
  Manager's Test Events tab.

## Ongoing: the background crons

All three are declared in `vercel.json`'s `crons` array, so there's nothing
to click in the Vercel dashboard — they're created automatically on deploy
as long as `CRON_SECRET` is set (see the env var table above):

- **`/api/meta/retry`** — retries failed Meta CAPI sends with backoff.
- **`/api/meta/sync-audiences`** — keeps every Meta Custom Audience
  current: creates/updates the three seed audiences (Landing visitors,
  Checkout started, Purchasers) and resyncs Purchasers' member list, then
  resolves and resyncs every segment linked from `/admin/segments`. No
  manual "sync now" step anywhere in this flow by design.
- **`/api/broadcasts/send-due`** — sends every scheduled event broadcast
  (from an event's "Correos del evento" section) whose real send time,
  fixed or relative to the event's own start/end, has arrived.

Default schedule is once daily (`0 3 * * *` / `0 4 * * *` / `0 5 * * *`) —
that's the fastest interval Vercel's free/Hobby tier allows for cron jobs.
**Every cron in `vercel.json` has to respect that limit, not just one of
them** — Vercel rejects the whole deploy if any single entry exceeds what
the plan allows, it doesn't just skip or throttle that one cron. (This bit
the `send-due` cron once already: it shipped as `*/15 * * * *` on the
assumption an over-frequent schedule would just run slower, and instead it
silently broke every deploy until it was caught and dropped back to
once/day — if a deploy ever seems stuck on an old commit, check this file
first.) **If you're on Vercel Pro**, tighten these in `vercel.json` for
fresher data: `*/5 * * *` for `retry` (matches the backoff design),
`0 */6 * * *` for `sync-audiences` (a full resync is cheap since Meta
dedupes the hashed upload, so shorter is safe too, just not necessary), and
something like `*/15 * * * *` for `send-due` if event broadcasts need to
land closer to their exact scheduled time.

All three routes still accept a manual `POST` for on-demand testing without
waiting for the schedule:

```bash
curl -X POST https://<your-deployment-url>/api/meta/sync-audiences \
  -H "x-cron-secret: <your INTERNAL_CRON_SECRET value>"
```

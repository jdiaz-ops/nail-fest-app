# WhatsApp — CRM → WhatsApp (direct Meta connection)

**Status: built, not yet verified against a real account.** This was built
overnight without real Meta credentials (see the commit this file shipped
with) — the request/response shapes in `lib/whatsapp/meta.ts` follow Meta's
own Cloud API reference exactly, and every part of the app that DOESN'T
require a real Meta call (the schema, the admin UI, the segment-targeting
and consent logic, the webhook's inbound-message processing and phone
matching, the 24h-window enforcement) has been exercised end-to-end
against a real local Postgres + a real running server. What has NOT been
exercised: an actual `sendTemplate`/`sendFreeform`/`listApprovedTemplates`
call reaching Meta's servers and getting a real 2xx back. Confirm that the
first time you connect a real account — see "First real send" below.

## Why direct to Meta, not another BSP (Business Solution Provider)

You were on WhatChimp (see the now-superseded `docs/WHATCHIMP_SETUP.md`
and `lib/whatsapp/whatchimp.ts`, kept for reference) — paying WhatChimp
monthly for the platform/inbox, and Meta directly for broadcast credits.
Moving off WhatChimp to a direct Cloud API connection:

- Drops the WhatChimp subscription entirely — you already pay Meta per
  message either way.
- Keeps everything that actually matters on a BSP switch: your verified
  phone number, its quality rating, its messaging limits, and any
  HIGH-QUALITY approved templates all transfer automatically — Meta ties
  those to the number/WABA, not to WhatChimp specifically.
- Does NOT keep: your WhatChimp chat history (starts fresh in the new
  Bandeja here) and any PENDING/REJECTED templates (recreate those
  directly in Meta's WhatsApp Manager if you still want them).

## What's built

- **Conexión** (`/admin/crm/whatsapp/conexion`) — stores your WABA ID,
  Phone Number ID and access token (encrypted at rest, same
  `lib/crypto.ts` AES-256-GCM as the Meta ads connection) plus a webhook
  verify token. Also shows the number's live status straight from Meta —
  verified name, quality rating (green/yellow/red), messaging limit tier
  — fetched fresh on every page load (WhatChimp's own Business Accounts
  panel), never cached.
- **Plantillas** (`/admin/crm/whatsapp/plantillas`) — create a template
  (name, language, category, optional text header, body with
  `{{1}}`/`{{2}}`/... variables + required examples, optional footer,
  optional buttons — either up to 3 quick replies, or a URL button and/or
  a call button) and it's submitted straight to Meta for review, same as
  using the WhatsApp Manager directly — MARKETING and UTILITY only
  (AUTHENTICATION has a fixed OTP-only shape Meta enforces, not built
  here; create one of those directly in Meta if you need it; a media
  header — image/video/document — also isn't built, text header only).
  Mirrors what's in Meta either way — "Sincronizar" pulls in anything
  created in Meta's own WhatsApp Manager, and is what picks up a PENDING
  → APPROVED/REJECTED transition after review (no webhook for that here;
  re-sync to see the current status).
- **Difusiones** (`/admin/crm/whatsapp/difusiones`) — sends an approved
  template to an existing, named segment (same segment engine as email
  broadcasts — `resolveSegment()`, including a `label` condition — see
  Etiquetas below), with a merge-tag mapping UI for the template's
  `{{1}}`, `{{2}}`, ... variables, a live text preview, and an optional
  "etiquetar a quien reciba esta difusión" so you can exclude that batch
  from a future round. Only sends to people with an active `WHATSAPP`
  consent AND a phone number on file — and the composer shows exactly who
  that will and won't include BEFORE you send it (`previewSegmentRecipients`
  in `lib/whatsapp/broadcasts.ts`, via `/api/admin/whatsapp/broadcasts/preview`):
  "Le llegará a X de Y personas (Z sin consentimiento de WhatsApp, W sin
  celular)", not just after the fact. Note this is a common surprise the
  first time you use it on an older/imported contact list: `WHATSAPP`
  consent is only ever granted at registration time (implicit in
  submitting `RegistrationForm.tsx`, same as `MARKETING`/`ADVERTISING`) —
  nothing backfills it retroactively for people who registered or were
  CSV-imported before this module existed, by design (Ley 1581 — you
  can't silently opt someone into a channel they never agreed to). Can be
  sent immediately or scheduled for an exact future date/time (via
  QStash — see "Envíos programados con precisión" below); the history
  table shows real Processed/Delivered/Read/Failed bars per broadcast
  (from the same message-status data the webhook keeps current), or
  "Programado para: [fecha]" while a scheduled one is still waiting, plus
  a "Reintentar fallidos" action and delete (also cancels a still-pending
  scheduled send).
- **Bandeja** (`/admin/crm/whatsapp/bandeja`) — inbox: a thread per phone
  number, matched to a CRM `Person` by phone when possible (last-10-digit
  match, so it's tolerant of the leading `+`/country code either way).
  Persistent split view, same shape as WhatChimp's own Shared Inbox — a
  conversation list stays visible on the left (`bandeja/layout.tsx` +
  `WhatsAppInboxList.tsx`, a client component polling its own
  `/api/admin/whatsapp/conversations` endpoint) while the open thread and
  a Chat-Actions-style sidebar fill the right (`bandeja/[id]/page.tsx`),
  switching between conversations without ever losing the list — Next's
  layout-persistence is what makes that free. Todos/No leídos/Asignados a
  mí filters live client-side in the list now (no longer a `?filter=`
  URL param). Reply is free text, enforced server-side to Meta's real 24h
  customer service window (measured from the contact's last inbound
  message, shown as a live countdown) — a closed window shows why and
  points at Difusiones instead of silently failing. A thread also has an
  internal Nota tab (never sent to WhatsApp), an assignable agent (any
  active `AdminUser`), the linked person's etiquetas, and a snapshot
  panel (cliente desde, último mensaje, idioma/país/zona horaria, and the
  contact's real acquisition UTM from their registration).
- **Etiquetas (Labels)** — a generic CRM tag (`Label`), not WhatsApp-
  specific: usable as a `label` segment condition (Segmentos), assignable
  after a Difusión send, and addable/removable from a person straight
  from their Bandeja thread. Created on first use, same "type a name and
  hit enter" UX as WhatChimp's own.
- **Consent**: `WHATSAPP` is its own `ConsentPurpose` (independently
  revocable from `MARKETING`/`ADVERTISING`), granted the same implicit way
  those are now — see `RegistrationForm.tsx`'s acceptance line — rather
  than a separate checkbox, to match how consent already works on this
  form for the other three purposes.
- **Webhook** (`/api/webhooks/whatsapp`) — GET handles Meta's verification
  handshake (`hub.verify_token` checked against what you saved in
  Conexión); POST receives inbound messages and delivery-status updates,
  signature-verified against `META_APP_SECRET` (`X-Hub-Signature-256`,
  HMAC-SHA256 over the raw body) before anything is processed.
- **Cron** (`/api/whatsapp/send-due`, `vercel.json`) — sends any QUEUED,
  non-IMMEDIATE broadcast whose scheduled time has arrived, same
  once/day cadence as `/api/broadcasts/send-due` for the same Vercel
  Hobby-plan reason (see that route's own comment).

## Setup, start to finish

1. In [Meta App Dashboard](https://developers.facebook.com/apps) → your
   app → **WhatsApp → API Setup**: copy the **Phone number ID** and the
   **WhatsApp Business Account ID**.
2. Generate a **permanent** token (not the 24h temporary one shown by
   default): Business Settings → **Users → System Users** → your System
   User (or create one) → Add Assets → assign it the WABA above with
   management access → **Generate New Token**, checking
   `whatsapp_business_messaging` and `whatsapp_business_management`.
3. In **WhatsApp → Configuration → Webhook**: paste
   `https://<your-domain>/api/webhooks/whatsapp` and a verify token of your
   choosing (anything long and random), then subscribe to the `messages`
   field — without this, Bandeja never receives anything.
4. Paste the token, WABA ID, Phone Number ID and the same verify token
   into `/admin/crm/whatsapp/conexion` and save — this also auto-runs
   step 4b below; if it shows a warning that it failed, use the retry
   button right there instead of redoing this step.
4b. **"Shadow delivery" — do this even if step 4's save didn't warn
    you.** A WABA only pushes webhook events to apps in its own
    `subscribed_apps` list — an *already-existing* WABA (one that was
    live with another BSP, e.g. WhatChimp, before you connected this
    app) does **not** automatically add this app to that list just
    because a System User has access to it. Without this, the webhook
    stays "Verified" in Meta's dashboard and messages keep flowing —
    just only to whichever app(s) were already subscribed (WhatChimp
    keeps working exactly as before; this doesn't touch or remove
    that). Symptom: you message the business number, it shows delivered
    in WhatsApp/WhatChimp, but Bandeja stays empty. Fix: Conexión has a
    "Suscribir esta app al WABA" button that does this automatically
    (`POST /{waba-id}/subscribed_apps` via `lib/whatsapp/meta.ts`'s
    `subscribeAppToWaba`) — or run it yourself once in [Graph API
    Explorer](https://developers.facebook.com/tools/explorer):
    method POST, path `<your WABA ID>/subscribed_apps`.
5. Create your first template directly in Meta's WhatsApp Manager (e.g. a
   simple confirmation message), wait for approval, then hit
   "Sincronizar con Meta" on `/admin/crm/whatsapp/plantillas`.
6. Make sure `META_APP_SECRET` is set in your environment (it already is
   if the Meta ads/CAPI module is connected — same Meta App) — the
   webhook signature check fails closed without it.
7. **Payment method + Publish**: the Meta App Dashboard's WhatsApp use
   case won't let you send business-initiated messages without a
   payment method on file (Add use cases → WhatsApp → "Missing valid
   payment method"), and won't deliver *any* production webhook data
   (only manual test webhooks) until the app itself is Published (App
   Dashboard → Publish — needs a real Privacy Policy URL set in App
   Settings; `/admin/settings/privacy` on this app already has a page
   for that, at `<your-domain>/privacidad`).
8. **Verify end to end before trusting a real send**: message the
   business number from your own phone and confirm it shows up in
   Bandeja — that's the one test that actually proves the webhook is
   wired correctly, not just "Verified" in Meta's dashboard.

## Envíos programados con precisión (QStash)

Difusiones' "A una fecha y hora programada" needs one more thing to fire
at the *exact* minute you pick — without it, a scheduled broadcast still
works, just up to ~24h late.

**Why:** this app's own daily cron (`/api/whatsapp/send-due`,
`vercel.json`) is a Vercel **Hobby plan** constraint — cron jobs on that
tier can only run once a day, so "programar para las 3pm" could
otherwise mean anywhere from 3pm to 3pm the next day. [Upstash
QStash](https://upstash.com/docs/qstash) fixes this properly instead of
just polling more often: you publish ONE message scheduled for an exact
unix timestamp, and QStash calls this app back at that moment — no
Vercel plan upgrade needed, since it's this app making an outbound HTTP
call to QStash, not a Vercel-side cron running more frequently. The
daily cron stays in place as a fallback (in case QStash isn't configured
yet, or a publish call fails) — scheduling never *silently* degrades:
if the exact-time schedule fails to set up, the composer shows a clear
warning right there instead of pretending it worked.

**Setup:**
1. Create a free account at [console.upstash.com](https://console.upstash.com)
   and open the **QStash** tab. Note the region shown next to "QStash"
   at the top (e.g. "QStash / US Region") — you'll need it in step 3.
2. Copy three values from there: **QSTASH_TOKEN** (top of the QStash
   page), and under **Signing Keys**: **Current signing key** and **Next
   signing key**.
3. Add environment variables in Vercel → your project → Settings →
   Environment Variables:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
   - `QSTASH_URL` — **required**, not optional, despite the SDK
     technically working without it in some setups. QStash runs
     region-pinned instances (US or EU, picked when you create the
     account), and the bare default endpoint
     (`https://qstash.upstash.io`) doesn't reliably route to the right
     one — it can land on the other region's cluster depending on where
     Vercel's function actually runs, which fails with `user (...) not
     found in this region`. Set this to match the region from step 1:
     - US Region → `https://qstash-us-east-1.upstash.io`
     - EU Region → `https://qstash-eu-central-1.upstash.io`
4. **Redeploy** (same gotcha as `META_APP_SECRET` earlier — a Vercel env
   var change doesn't touch an already-running deployment).
5. Schedule a test Difusión a few minutes out and confirm it actually
   sends at that time, not just "eventually." If the composer shows "No
   se pudo programar la hora exacta" after saving these env vars
   correctly, check Vercel → Logs for a line starting with `qstash:
   failed to schedule whatsapp broadcast send` — the real error from
   Upstash is right there (wrong region is the most common one; a typo'd
   token or missing Redeploy are the other two).

Nothing else in the app depends on QStash — Conexión, Plantillas,
Bandeja and an *immediate* Difusión all work exactly the same with or
without it configured.

## First real send

Send yourself a test broadcast from Difusiones (a segment of just you)
before sending anything wider. If `lib/whatsapp/meta.ts`'s request shape
turns out to need adjusting against your real account, that file — and
only that file — is where to fix it; nothing else in the app (the
broadcast/inbox logic, the UI, the consent gating) depends on the exact
Graph API payload shape.

## Not built

- **The visual Flow Builder / chatbot automation engine** — WhatChimp's
  actual core product (drag-and-drop message/condition/sequence blocks).
  This app replaces WhatChimp's broadcast + inbox + template management,
  not its automation builder — a deliberate scope call, not an oversight.
  See the commit this note shipped with for the full reasoning.
- **Media template headers** (image/video/document) — text header only.
- **Dynamic header/button variables at send time** — `meta.ts`'s
  `sendTemplate` only fills BODY `{{n}}` variables; a template whose
  header or URL button itself has a `{{1}}` would need `components`
  extended to cover those too (this app's own templates don't need one).
- **Media messages** (images, PDFs, voice notes) in either direction —
  text only, both inbound and outbound.
- **Translation and canned/saved replies** in the inbox composer.
- **Multiple WABAs/phone numbers** — one active connection at a time,
  same as before.
- **Event-scoped broadcasts** ("everyone registered for event X", like
  `EventBroadcastComposer.tsx`'s email equivalent) — the schema supports
  it (`WhatsAppBroadcast.eventId`), but Difusiones only has the
  segment-picker composer today; build a segment for that event's
  registrants in Segmentos as the workaround until a second composer
  surface is built.

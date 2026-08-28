# Nail Fest — Slice 1

Internal registration platform for Nail Fest events. This is **Slice 1** of
the larger plan (replacing Ticket Tailor): landing → registration → CRM →
Meta attribution → email broadcast, built as one thin vertical slice to
prove out before the rest (check-in/aforo app, TikTok/Google, landing
editor, referrals, roles, etc.) gets built.

## What's in this slice

- Coded landing page per event (`/[eventSlug]`) — no visual editor yet
- Registration form: custom fields (profession, city), consent recorded
  **separately per purpose** (logistics / marketing / advertising), per
  Ley 1581
- Deduplicated CRM (`Person`, unique by email)
- Signed QR ticket, emailed on confirmation (never invalidated — see
  `src/lib/ticket.ts`, ready for the future check-in app's reentry model)
- Meta Conversions API: `PageView`, `ViewContent`, `InitiateCheckout`,
  `Purchase` — System User auth (not OAuth), idempotent via `event_id`,
  retried with backoff on failure
- Meta Custom Audiences: Landing visitors (30d), Checkout started (30d),
  Purchasers (180d)
- Shared segment builder (`src/lib/segments/builder.ts`) — same engine
  behind audience sync and email broadcasts, e.g. "manicuristas que no
  asistieron a Cali 2025"
- SES email, transactional and marketing kept on **separate Configuration
  Sets**; broadcasts require the recipient's own marketing consent and
  carry a working one-click unsubscribe (`RFC 8058`)
- Minimal admin UI: `/admin/registrations`, `/admin/broadcasts`

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npx prisma migrate dev --name init
npm run db:seed        # creates one test event + profession options
npm run meta:setup     # after following docs/META_SETUP.md
npm run dev
```

Then open `http://localhost:3000/bogota-2026` to see the seeded event.

Full setup guides:
- [`docs/META_SETUP.md`](docs/META_SETUP.md) — System User token, Pixel,
  Test Events
- [`docs/SES_SETUP.md`](docs/SES_SETUP.md) — domain verification,
  Configuration Sets, production access request

## How to test it end to end

1. Register through the landing page with your own email (SES sandbox mode
   only sends to verified addresses — verify your own first).
2. Check `/admin/registrations` — the person and registration should show
   up, deduplicated if you register twice with the same email.
3. Check your inbox for the QR ticket email.
4. With `META_TEST_EVENT_CODE` set, check Meta Events Manager → Test Events
   — you should see `PageView`, `ViewContent`, `InitiateCheckout` land as
   you use the form, and `Purchase` after a successful submit **if you
   checked the advertising consent box**.
5. Go to `/admin/broadcasts`, build a segment, send a test broadcast to
   yourself, confirm the unsubscribe link in the footer works
   (`/api/unsubscribe`).

## Known simplifications (deliberate, not oversights)

- **No browser Meta Pixel snippet yet** — this slice is CAPI-only
  (server-side). Adding the client-side `fbq()` snippet with a matching
  `eventID` for dedup is a small follow-up, not a redesign.
- **Broadcast sending is synchronous**, in small batches, inside one
  request — fine for testing against a modest list. Move it to a
  background job before sending to a full 10k+ segment (flagged in
  `src/app/api/broadcasts/route.ts`).
- **"Attended" segment filtering uses confirmed registration as a proxy**
  — real check-in-based attendance needs the scanning app (a later phase).
  Swap the resolver in `src/lib/segments/builder.ts` once that data exists.
- **Meta CAPI retry only re-sends `Purchase`-style events tied to a
  registration** (`processDueMetaEvents` looks up the registration to
  rebuild `user_data`). `PageView`/`ViewContent`/`InitiateCheckout` failures
  currently retry with no `user_data` to rebuild from — low-impact since
  those carry no PII anyway, but worth knowing.
- **`Purchase` value is a placeholder** (`META_PURCHASE_PLACEHOLDER_VALUE`,
  defaults to `1`) — swap for a real figure before relying on it for bid
  optimization, per the brief discussion.

## Security note

Pinned to Next.js 14.2.35 (latest 14.x patch), which closes the
critical/most high-severity advisories that were open at 14.2.15. Two
`npm audit` findings remain that only resolve on the Next 16 major
(`GHSA-955p-x3mx-jcvp`, and a transitive PostCSS advisory) — not applied
here since a major-version bump needs its own testing pass, not a
drive-by dependency update. Worth scheduling before this goes live with
real traffic; run `npm audit` to re-check status.

## Deferred to later phases (not in this slice at all)

Check-in/aforo scanning app, TikTok + Google tracking, visual landing
editor, referrals, team roles/permissions, post-event survey, duplicate
detection beyond email-based dedup, OTP phone verification, WhatsApp.

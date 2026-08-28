# WhatChimp (WhatsApp broadcast) — preparation status

**Status: code scaffolded, not activated.** `src/lib/whatsapp/` exists and
typechecks, but nothing in the app calls it yet — no route sends a WhatsApp
message today. This is groundwork for when you're ready to turn it on, not
a working feature.

## Why WhatChimp over building the WhatsApp Business API integration directly

You already have WhatChimp connected and working (verified number, "High"
quality rating, full-control partner access in Meta Business Settings) —
no reason to rebuild what already works. If that ever changes, the
provider interface (`src/lib/whatsapp/provider.ts`) is the seam: a
different file implementing `WhatsAppProvider`, not a rewrite of
everything that calls it.

## What's built

- `WhatsAppProvider` interface — `sendTemplate({ to, templateName, variables })`
- `whatchimpProvider` — calls WhatChimp's API with Bearer auth
- `WHATSAPP` added to `ConsentPurpose` (separate from `MARKETING` — Meta's
  WhatsApp policy and Ley 1581 both treat this as its own opt-in, not
  something an email marketing checkbox covers)

## What's NOT built yet (needed before this goes live)

1. **Verify the exact API request shape against your account.** The
   endpoint/payload in `whatchimp.ts` is built from WhatChimp's published
   docs pattern, but was never exercised against a real account — this
   session had no credentials to test with. Before relying on it:
   - Log into your WhatChimp dashboard → API Console
   - Confirm the exact endpoint path and payload keys for sending a
     template message
   - Update `whatchimp.ts` to match if anything differs
2. **A `WHATCHIMP_API_TOKEN`** from your WhatChimp account (dashboard →
   API/Integration settings)
3. **Approved message templates** — WhatsApp requires business-initiated
   messages to use pre-approved templates. Decide what messages you want
   (registration confirmation? T-7/T-1 reminders?) and get them approved
   in WhatChimp/Meta before wiring in the send calls.
4. **A consent checkbox on the registration form** for the new `WHATSAPP`
   purpose — the form doesn't ask for this yet.
5. **Where it actually gets called from** — most likely alongside the
   email confirmation in `/api/register`, and/or a WhatsApp equivalent of
   the broadcast composer. Neither exists yet.

## When you're ready

Come back to this file, fill in the env vars, confirm the API shape, and
we wire steps 4–5 in — same pattern as the Meta and SES modules were built
ahead of activation, then turned on once credentials existed.

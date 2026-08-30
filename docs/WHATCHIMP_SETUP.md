# WhatChimp (WhatsApp broadcast) — superseded

**This module was never activated and is no longer the plan.** The app
moved to a direct Meta Cloud API connection instead of WhatChimp — see
**`docs/WHATSAPP_SETUP.md`** for the real, built module (CRM → WhatsApp:
Conexión, Plantillas, Difusiones, Bandeja).

`src/lib/whatsapp/whatchimp.ts` is kept in the repo for reference only —
nothing imports it anymore (`src/lib/whatsapp/index.ts` exports the Meta
provider). `WHATCHIMP_API_TOKEN`/`WHATCHIMP_BASE_URL` in `.env.example`
are dead env vars from this abandoned direction; safe to ignore or remove.

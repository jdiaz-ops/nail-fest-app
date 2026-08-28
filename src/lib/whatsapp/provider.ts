// Same reasoning as lib/email/provider.ts: calling code depends on THIS
// interface, never WhatChimp's client directly — if WhatChimp turns out not
// to fit, or you switch to the WhatsApp Business API directly later, that's
// a new file behind this interface, not a rewrite of every call site.
//
// WhatsApp Business Platform (whether reached via WhatChimp or directly)
// requires business-initiated messages to use a pre-approved template —
// unlike email, you can't just send arbitrary text. That's why this is
// sendTemplate(), not sendMessage().

export interface WhatsAppTemplateMessage {
  to: string; // E.164, e.g. +57...
  templateName: string; // must already be approved in WhatChimp/Meta
  variables: Record<string, string>;
}

export interface WhatsAppProvider {
  sendTemplate(input: WhatsAppTemplateMessage): Promise<{ providerMessageId: string }>;
}

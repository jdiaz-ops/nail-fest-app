// Same reasoning as lib/email/provider.ts: calling code depends on THIS
// interface, never a specific vendor's client directly. Originally written
// against WhatChimp; extended here for the direct-to-Meta implementation
// (lib/whatsapp/meta.ts) that replaces it — see docs/WHATSAPP_SETUP.md.
//
// WhatsApp Business Platform requires BUSINESS-initiated messages to use a
// pre-approved template — unlike email, you can't just send arbitrary text
// to open a conversation. That's sendTemplate(). Once a contact has messaged
// in (an inbound message), a 24h "customer service window" opens during
// which plain free text is allowed — that's sendFreeform(), used only by
// the inbox reply composer, never by a broadcast.

export interface WhatsAppTemplateMessage {
  to: string; // E.164, e.g. +57...
  templateName: string; // must already be approved in Meta's WhatsApp Manager
  languageCode: string; // e.g. "es" — must match the approved template's language exactly
  /** Positional {{1}}, {{2}}, ... body variables, in order. */
  variables: string[];
  /** The per-recipient value for a dynamic URL button's own {{1}} suffix
   * (e.g. a qrToken) — only meaningful when the template's one button is
   * a URL button whose `url` ends in "{{1}}" (see WhatsAppTemplateButton
   * below). Assumes that button is the template's first (and only) one —
   * true for every template this app creates today. Omit for a template
   * with no dynamic button. */
  buttonUrlParam?: string;
}

export interface WhatsAppFreeformMessage {
  to: string; // E.164
  text: string;
}

// A document sent inside the 24h freeform window — same rules as a text
// reply (see WhatsAppFreeformMessage), just a PDF instead of text. Sent
// by `link`, not a pre-uploaded media id: Meta's Cloud API fetches the
// URL itself at send time, so the caller needs no separate media-upload
// step — see /api/ticket-pdf/[token] (the public URL this points at,
// same pattern as /api/ticket-qr's PNG).
export interface WhatsAppDocumentMessage {
  to: string; // E.164
  link: string; // publicly fetchable HTTPS URL — Meta's servers download from it directly
  filename: string;
  caption?: string;
}

// Meta's real button component shapes. A URL button can be dynamic — its
// `url` ends in a literal "{{1}}" placeholder, filled per-recipient at
// send time (WhatsAppTemplateMessage.buttonUrlParam) the same way Meta's
// own examples do it (e.g. LATAM Airlines' "Ver tarjeta de embarque"
// button, one link per passenger) — `urlExample` is the one real value
// Meta requires at template-creation time to review a dynamic button, same
// role as CreateWhatsAppTemplateInput.bodyExamples for a body variable.
// Undefined `urlExample` means a plain static URL, same as before.
export type WhatsAppTemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; urlExample?: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string };

/** What Meta's own template list API returns per template — see
 * lib/whatsapp/templates.ts's syncTemplates(), which maps this onto the
 * WhatsAppTemplate table. Despite the old name (listApprovedTemplates),
 * this was never filtered to APPROVED only — it lists every template
 * regardless of status, which is exactly what lets the sync button pick
 * up a PENDING → APPROVED/REJECTED transition later. Renamed to
 * listTemplates to stop that name lying. */
export interface RemoteWhatsAppTemplate {
  metaTemplateId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  headerType: "NONE" | "TEXT";
  headerText: string | null;
  bodyText: string | null;
  variableCount: number;
  footerText: string | null;
  buttons: WhatsAppTemplateButton[];
}

// Only MARKETING/UTILITY are creatable from this app's form — an
// AUTHENTICATION template has a fundamentally different required shape
// in Meta's API (a fixed OTP body plus a COPY_CODE/ONE_TAP button, not a
// free-text BODY component), not worth building blind without a real
// account to verify against. Create those directly in Meta's WhatsApp
// Manager if you need one — they'll still show up here on the next sync.
export interface CreateWhatsAppTemplateInput {
  name: string; // Meta's naming rule: lowercase letters, digits, underscores only
  language: string; // e.g. "es" or "es_CO"
  category: "MARKETING" | "UTILITY";
  headerText?: string; // plain text header only — no image/video/document
  bodyText: string; // with {{1}}, {{2}}, ... placeholders, sequential from 1
  /** One example value per placeholder, same order — Meta requires a
   * real example for every variable before it will even queue a
   * template for review. */
  bodyExamples: string[];
  footerText?: string;
  /** Up to 3 buttons, all the same type — Meta doesn't allow mixing
   * QUICK_REPLY with URL/PHONE_NUMBER in one template. */
  buttons?: WhatsAppTemplateButton[];
}

/** Live status straight from Meta — the Conexión page's own "quality
 * rating / messaging limit" panel (WhatChimp's own Business Accounts
 * table). Fetched fresh on page load, never cached — a phone number's
 * quality rating is exactly the kind of thing that shouldn't go stale in
 * a database column. */
export interface WhatsAppPhoneNumberStatus {
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string; // e.g. "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
  messagingLimitTier: string | null; // e.g. "TIER_1K", "TIER_100K" — null if not yet tiered
}

export interface WhatsAppProvider {
  sendTemplate(input: WhatsAppTemplateMessage): Promise<{ providerMessageId: string }>;
  sendFreeform(input: WhatsAppFreeformMessage): Promise<{ providerMessageId: string }>;
  sendDocument(input: WhatsAppDocumentMessage): Promise<{ providerMessageId: string }>;
  listTemplates(): Promise<RemoteWhatsAppTemplate[]>;
  createTemplate(input: CreateWhatsAppTemplateInput): Promise<{ metaTemplateId: string; status: RemoteWhatsAppTemplate["status"] }>;
  getPhoneNumberStatus(): Promise<WhatsAppPhoneNumberStatus>;
}

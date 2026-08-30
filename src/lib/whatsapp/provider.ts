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
}

export interface WhatsAppFreeformMessage {
  to: string; // E.164
  text: string;
}

/** What Meta's own template list API returns per template — see
 * lib/whatsapp/templates.ts's syncTemplates(), which maps this onto the
 * WhatsAppTemplate table. */
export interface RemoteWhatsAppTemplate {
  metaTemplateId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  bodyText: string | null;
  variableCount: number;
}

export interface WhatsAppProvider {
  sendTemplate(input: WhatsAppTemplateMessage): Promise<{ providerMessageId: string }>;
  sendFreeform(input: WhatsAppFreeformMessage): Promise<{ providerMessageId: string }>;
  listApprovedTemplates(): Promise<RemoteWhatsAppTemplate[]>;
}

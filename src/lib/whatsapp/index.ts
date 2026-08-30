import { metaWhatsAppProvider } from "./meta";
import type { WhatsAppProvider } from "./provider";

// The one place a provider swap gets wired in — same pattern as
// lib/email/index.ts. Was whatchimpProvider (src/lib/whatsapp/whatchimp.ts)
// until the move off WhatChimp to a direct Meta connection (see
// docs/WHATSAPP_SETUP.md) — that file is kept for reference, not deleted,
// but nothing imports it anymore.
export const whatsappProvider: WhatsAppProvider = metaWhatsAppProvider;

export type {
  WhatsAppTemplateMessage,
  WhatsAppFreeformMessage,
  RemoteWhatsAppTemplate,
} from "./provider";

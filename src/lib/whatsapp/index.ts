import { whatchimpProvider } from "./whatchimp";
import type { WhatsAppProvider } from "./provider";

// The one place a provider swap gets wired in — same pattern as
// lib/email/index.ts.
export const whatsAppProvider: WhatsAppProvider = whatchimpProvider;

export type { WhatsAppTemplateMessage } from "./provider";

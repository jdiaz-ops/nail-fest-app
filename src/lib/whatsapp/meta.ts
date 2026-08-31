import type {
  CreateWhatsAppTemplateInput,
  RemoteWhatsAppTemplate,
  WhatsAppFreeformMessage,
  WhatsAppPhoneNumberStatus,
  WhatsAppProvider,
  WhatsAppTemplateButton,
  WhatsAppTemplateMessage,
} from "./provider";
import { getWhatsAppConnection } from "./connection";

// Direct WhatsApp Cloud API (Graph API) implementation — replaces
// WhatChimp as the active provider (see docs/WHATSAPP_SETUP.md, "por qué
// directo a Meta y no otro BSP"). Same Graph API version as
// lib/meta/audiences.ts's ads client, for consistency; WhatsApp Cloud API
// endpoints live under the same graph.facebook.com host.
//
// IMPORTANT — this has NOT been exercised against a real WABA/phone
// number: this session had no Meta credentials to test with (see
// docs/WHATSAPP_SETUP.md). The request/response shapes below are built
// directly from Meta's own Cloud API reference
// (developers.facebook.com/docs/whatsapp/cloud-api/reference) — a
// documented best-effort implementation, not a verified integration, the
// same caveat lib/whatsapp/whatchimp.ts carried before it. Confirm against
// a real send once credentials are in (see the Conexión page's own note).
const GRAPH_VERSION = "v21.0";

async function graphFetch(path: string, token: string, init?: RequestInit) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp Cloud API ${res.status} on ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function sendTemplate(input: WhatsAppTemplateMessage): Promise<{ providerMessageId: string }> {
  const conn = await getWhatsAppConnection();
  const json = await graphFetch(`${conn.phoneNumberId}/messages`, conn.token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toGraphPhone(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        // Meta requires one "components" entry per template part that
        // actually has variables — this app's templates only ever put
        // variables in the BODY (see WhatsAppBroadcast.variableMapping's
        // own comment), never in the header/buttons, so this stays just
        // the one component regardless of whether the template also has
        // a static header/footer/buttons — those don't need a components
        // entry at send time unless THEY have a variable too.
        components:
          input.variables.length > 0
            ? [{ type: "body", parameters: input.variables.map((text) => ({ type: "text", text })) }]
            : [],
      },
    }),
  });
  const providerMessageId = json?.messages?.[0]?.id;
  if (!providerMessageId) throw new Error("WhatsApp Cloud API did not return a message id");
  return { providerMessageId };
}

async function sendFreeform(input: WhatsAppFreeformMessage): Promise<{ providerMessageId: string }> {
  const conn = await getWhatsAppConnection();
  const json = await graphFetch(`${conn.phoneNumberId}/messages`, conn.token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toGraphPhone(input.to),
      type: "text",
      text: { body: input.text },
    }),
  });
  const providerMessageId = json?.messages?.[0]?.id;
  if (!providerMessageId) throw new Error("WhatsApp Cloud API did not return a message id");
  return { providerMessageId };
}

async function listTemplates(): Promise<RemoteWhatsAppTemplate[]> {
  const conn = await getWhatsAppConnection();
  const templates: RemoteWhatsAppTemplate[] = [];
  // Paginated — a growing template library shouldn't silently truncate at
  // whatever Meta's default page size is.
  let path: string | null = `${conn.wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`;
  while (path) {
    const json = await graphFetch(path, conn.token);
    for (const raw of json.data ?? []) {
      templates.push(mapRemoteTemplate(raw));
    }
    const next: string | undefined = json.paging?.next;
    // graphFetch always prefixes with our own base URL, so a raw `next`
    // URL from Meta (which is already fully-qualified) needs stripping
    // back down to the path+query graphFetch expects.
    path = next ? next.replace(`https://graph.facebook.com/${GRAPH_VERSION}/`, "") : null;
  }
  return templates;
}

interface RawTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
}

function mapRemoteButton(raw: { type: string; text: string; url?: string; phone_number?: string }): WhatsAppTemplateButton | null {
  if (raw.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: raw.text };
  if (raw.type === "URL" && raw.url) return { type: "URL", text: raw.text, url: raw.url };
  if (raw.type === "PHONE_NUMBER" && raw.phone_number) return { type: "PHONE_NUMBER", text: raw.text, phoneNumber: raw.phone_number };
  return null; // an unsupported button type (e.g. COPY_CODE/OTP-only ones) — dropped, not built
}

function mapRemoteTemplate(raw: {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: RawTemplateComponent[];
}): RemoteWhatsAppTemplate {
  const header = raw.components?.find((c) => c.type === "HEADER");
  const body = raw.components?.find((c) => c.type === "BODY");
  const footer = raw.components?.find((c) => c.type === "FOOTER");
  const buttonsComponent = raw.components?.find((c) => c.type === "BUTTONS");

  const bodyText = body?.text ?? null;
  const variableCount = bodyText ? new Set(Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1])).size : 0;
  // Only a TEXT header maps cleanly onto this app's model — an
  // IMAGE/VIDEO/DOCUMENT header (format !== "TEXT") shows as no header
  // here rather than a broken one, since sending/creating those isn't
  // built (see CreateWhatsAppTemplateInput's own comment).
  const headerType = header && header.format === "TEXT" ? "TEXT" : "NONE";
  const headerText = headerType === "TEXT" ? header?.text ?? null : null;

  return {
    metaTemplateId: raw.id,
    name: raw.name,
    language: raw.language,
    category: (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(raw.category) ? raw.category : "UTILITY") as RemoteWhatsAppTemplate["category"],
    status: (["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].includes(raw.status) ? raw.status : "PENDING") as RemoteWhatsAppTemplate["status"],
    headerType,
    headerText,
    bodyText,
    variableCount,
    footerText: footer?.text ?? null,
    buttons: (buttonsComponent?.buttons ?? []).map(mapRemoteButton).filter((b): b is WhatsAppTemplateButton => b !== null),
  };
}

// Cloud API wants digits only, no leading "+" — E.164 minus the plus sign.
function toGraphPhone(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

function buttonToPayload(btn: WhatsAppTemplateButton): Record<string, unknown> {
  if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.url };
  if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phoneNumber };
  return { type: "QUICK_REPLY", text: btn.text };
}

async function createTemplate(
  input: CreateWhatsAppTemplateInput
): Promise<{ metaTemplateId: string; status: RemoteWhatsAppTemplate["status"] }> {
  const conn = await getWhatsAppConnection();

  const components: Record<string, unknown>[] = [];
  if (input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }
  components.push({
    type: "BODY",
    text: input.bodyText,
    // Meta rejects a template with unfilled {{n}} variables and no
    // example — one example set covering every placeholder, same
    // order they appear in the body.
    ...(input.bodyExamples.length > 0 ? { example: { body_text: [input.bodyExamples] } } : {}),
  });
  if (input.footerText) {
    components.push({ type: "FOOTER", text: input.footerText });
  }
  if (input.buttons && input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons.map(buttonToPayload) });
  }

  const json = await graphFetch(`${conn.wabaId}/message_templates`, conn.token, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    }),
  });

  const metaTemplateId = json?.id;
  if (!metaTemplateId) throw new Error("WhatsApp Cloud API did not return a template id");
  // Meta returns the initial review status right away — always PENDING in
  // practice, but read it rather than assume, in case that ever changes.
  const status = (["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].includes(json.status) ? json.status : "PENDING") as RemoteWhatsAppTemplate["status"];
  return { metaTemplateId, status };
}

async function getPhoneNumberStatus(): Promise<WhatsAppPhoneNumberStatus> {
  const conn = await getWhatsAppConnection();
  const json = await graphFetch(`${conn.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`, conn.token);
  return {
    displayPhoneNumber: json.display_phone_number ?? "",
    verifiedName: json.verified_name ?? "",
    qualityRating: json.quality_rating ?? "UNKNOWN",
    messagingLimitTier: json.messaging_limit_tier ?? null,
  };
}

// The "shadow delivery" gotcha: saving a connection (token + WABA ID +
// phone number ID) is NOT enough for THIS app's webhook to receive
// anything. A WABA only pushes events to apps in its own
// `subscribed_apps` list — connecting via a System User's Add Assets
// doesn't add this app to that list, so an already-existing WABA (one
// that was already live with another BSP, e.g. WhatChimp) silently keeps
// sending webhooks only to whichever app(s) were already subscribed. This
// is additive, not exclusive — subscribing this app never removes
// another one already on the list (WhatChimp keeps working exactly as
// before). Called right after saving a new connection, and re-callable
// any time from the Conexión page in case the first attempt failed or an
// already-saved connection predates this fix.
export async function subscribeAppToWaba(wabaId: string, token: string): Promise<void> {
  const json = await graphFetch(`${wabaId}/subscribed_apps`, token, { method: "POST" });
  if (!json?.success) {
    throw new Error(`WhatsApp Cloud API did not confirm the subscription: ${JSON.stringify(json)}`);
  }
}

export const metaWhatsAppProvider: WhatsAppProvider = {
  sendTemplate,
  sendFreeform,
  listTemplates,
  createTemplate,
  getPhoneNumberStatus,
};

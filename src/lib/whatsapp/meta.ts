import type {
  RemoteWhatsAppTemplate,
  WhatsAppFreeformMessage,
  WhatsAppProvider,
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
        // actually has variables — this app's templates only ever use a
        // BODY with positional {{1}}, {{2}}, ... variables (see
        // WhatsAppBroadcast.variableMapping's own comment), so this is
        // deliberately just the one component, not a general renderer
        // for header/button variables too.
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

async function listApprovedTemplates(): Promise<RemoteWhatsAppTemplate[]> {
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
  text?: string;
}

function mapRemoteTemplate(raw: {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: RawTemplateComponent[];
}): RemoteWhatsAppTemplate {
  const body = raw.components?.find((c) => c.type === "BODY");
  const bodyText = body?.text ?? null;
  const variableCount = bodyText ? new Set(Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1])).size : 0;
  return {
    metaTemplateId: raw.id,
    name: raw.name,
    language: raw.language,
    category: (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(raw.category) ? raw.category : "UTILITY") as RemoteWhatsAppTemplate["category"],
    status: (["APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].includes(raw.status) ? raw.status : "PENDING") as RemoteWhatsAppTemplate["status"],
    bodyText,
    variableCount,
  };
}

// Cloud API wants digits only, no leading "+" — E.164 minus the plus sign.
function toGraphPhone(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

export const metaWhatsAppProvider: WhatsAppProvider = { sendTemplate, sendFreeform, listApprovedTemplates };

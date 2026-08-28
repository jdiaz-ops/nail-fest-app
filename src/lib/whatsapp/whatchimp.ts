import type { WhatsAppProvider, WhatsAppTemplateMessage } from "./provider";

// NOT WIRED IN YET — no route calls this. Prepared ahead of time so
// activating it later is "add the API key and call sendTemplate()", not
// "start from zero". See docs/WHATCHIMP_SETUP.md.
//
// The exact request shape below (endpoint path, payload keys) is built
// from WhatChimp's published API pattern (Bearer token auth, template name
// + variables — help.whatchimp.com/docs/whatchimp-apis) but hasn't been
// exercised against a real account, since this session never had
// credentials to test with. Confirm the exact endpoint/payload against
// your account's API console (help.whatchimp.com/docs/whatchimp-apis/getting-started-with-whatchimp-api)
// before relying on this — the shape here is a documented best-effort
// starting point, not a verified integration, the same caveat SES/Meta
// don't need since those WERE tested end-to-end.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function sendTemplate(input: WhatsAppTemplateMessage): Promise<{ providerMessageId: string }> {
  const token = requireEnv("WHATCHIMP_API_TOKEN");
  const baseUrl = process.env.WHATCHIMP_BASE_URL || "https://api.whatchimp.com";

  const res = await fetch(`${baseUrl}/v1/messages/template`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      template_name: input.templateName,
      variables: input.variables,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatChimp API ${res.status}: ${JSON.stringify(json)}`);
  }

  const providerMessageId = json.id ?? json.message_id;
  if (!providerMessageId) throw new Error("WhatChimp did not return a message id");
  return { providerMessageId };
}

export const whatchimpProvider: WhatsAppProvider = { sendTemplate };

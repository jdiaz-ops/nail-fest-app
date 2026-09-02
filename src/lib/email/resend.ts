import { Resend } from "resend";
import type { EmailProvider, SendEmailInput } from "./provider";
import { getOrgSettings } from "@/lib/settings";

// Plan B for src/lib/email/ses.ts — see docs/RESEND_SETUP.md for exactly
// when/how this goes live (flip EMAIL_PROVIDER=resend in src/lib/email/
// index.ts's env var, nothing else changes). Deliberately calls Resend's
// plain /emails endpoint for BOTH our sendTransactional and sendMarketing
// — never Resend's own /broadcasts+Audience feature, which would need
// every recipient synced into Resend as a "Contact" first. Our own
// segment/broadcast engine (lib/broadcasts.ts) already does everything
// that feature would, against our own data — using it too would just be
// a second, disconnected copy. Resend bills all of this as "transactional"
// volume (its own /emails-vs-/broadcasts distinction is which endpoint
// you call, not the content) — see the pricing conversation this was
// built from.

let _client: Resend | undefined;
function getClient(): Resend {
  if (!_client) {
    _client = new Resend(requireEnv("RESEND_API_KEY"));
  }
  return _client;
}

async function send(
  input: SendEmailInput,
  opts: { fromEnvVar: string; channel: "transactional" | "marketing" }
): Promise<{ providerMessageId: string }> {
  // requireEnv() happens IN HERE, not at the sendTransactional/
  // sendMarketing call site below — see ses.ts's send() for why (a plain
  // arrow function throwing synchronously breaks every
  // Promise.allSettled-based caller instead of rejecting like any other
  // send failure).
  const from = requireEnv(opts.fromEnvVar);

  // Explicit input.replyTo wins; otherwise fall back to the account-wide
  // setting (/admin/settings/contact) — same reasoning as ses.ts's own
  // send().
  const replyTo = input.replyTo ?? (await getOrgSettings()).replyToEmail ?? undefined;

  const { data, error } = await getClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
    headers: input.listUnsubscribeHeader
      ? {
          "List-Unsubscribe": input.listUnsubscribeHeader,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
    // No reputation-isolation equivalent to SES's Configuration Sets here
    // (see docs/RESEND_SETUP.md) — this tag at least keeps the two
    // channels distinguishable in Resend's own dashboard/logs.
    tags: [{ name: "channel", value: opts.channel }],
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  if (!data?.id) throw new Error("Resend did not return an email id");
  return { providerMessageId: data.id };
}

export const resendProvider: EmailProvider = {
  sendTransactional: (input) => send(input, { fromEnvVar: "RESEND_FROM_TRANSACTIONAL", channel: "transactional" }),
  sendMarketing: (input) => send(input, { fromEnvVar: "RESEND_FROM_MARKETING", channel: "marketing" }),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

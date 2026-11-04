// Provider abstraction: registration/broadcast code calls THIS interface,
// never the AWS SDK directly. Swapping SES for SendGrid/Mailgun/Postmark
// later (see docs/PLAN.md "chance of being accepted") is then a change to
// this one file plus an env var, not a rewrite.

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** RFC 8058 header — required on every marketing send, never on transactional. */
  listUnsubscribeHeader?: string;
  attachments?: EmailAttachment[];
  /** From OrgSettings.replyToEmail (see /admin/settings/contact) — omit to fall back to the From address. */
  replyTo?: string;
  /** The name in its From, for an event's emails (lib/brand.ts senderNameFor, 2026-11-04) — omit for «Nail Fest». */
  fromName?: string;
}

export interface EmailProvider {
  sendTransactional(input: SendEmailInput): Promise<{ providerMessageId: string }>;
  sendMarketing(input: SendEmailInput): Promise<{ providerMessageId: string }>;
}

// SES_FROM_TRANSACTIONAL/SES_FROM_MARKETING (and their Resend
// equivalents) are bare addresses ("tickets@nailfest.co") — with no
// display name in the From header, Gmail and most other clients fall
// back to showing the address's own LOCAL PART ("tickets") in the inbox
// list instead of a real name. Wraps it with one so "Tu entrada para
// Nail Fest..." shows up FROM "Nail Fest", not "tickets" — shared by
// both providers (ses.ts/resend.ts) so they never drift. Left alone if
// the env var was already hand-written with a display name — unless the
// email names its own sender (an event's, «Manicuristas Imparables»,
// 2026-11-04): then that name, on the same address.
export function friendlyFrom(email: string, name?: string): string {
  // Nothing that could break the header out of its name.
  const own = (name ?? "").replace(/[\r\n"<>\\]/g, "").trim();
  if (!own) return email.includes("<") ? email : `Nail Fest <${email}>`;
  const address = email.includes("<") ? email.slice(email.lastIndexOf("<") + 1, email.lastIndexOf(">")).trim() : email.trim();
  // A name with a comma, a dot or the like goes in quotes.
  return `${/[()[\]:;@,.]/.test(own) ? `"${own}"` : own} <${address}>`;
}

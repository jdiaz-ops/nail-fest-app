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
}

export interface EmailProvider {
  sendTransactional(input: SendEmailInput): Promise<{ providerMessageId: string }>;
  sendMarketing(input: SendEmailInput): Promise<{ providerMessageId: string }>;
}

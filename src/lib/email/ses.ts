import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import type { EmailProvider, SendEmailInput } from "./provider";
import { getOrgSettings } from "@/lib/settings";

// Two logically separate channels on the SAME SES account/domain, per
// docs/PLAN.md: different Configuration Sets so a marketing complaint spike
// can't drag down the reputation of the transactional channel that
// delivers the QR ticket. Create both Configuration Sets in the SES console
// before going live — see docs/SES_SETUP.md.
//
// Routed through nodemailer's SES transport rather than calling
// SendEmailCommand directly: SES's "Simple" content type (what the SDK's
// SendEmailCommand builds on its own) has no attachment support at all —
// getting a QR file attached onto the ticket email requires building a raw
// MIME message, which nodemailer does for us instead of hand-rolling it.

let _client: SESv2Client | undefined;
function getClient(): SESv2Client {
  if (!_client) {
    // Env var left blank in Vercel's UI is "", not undefined — `||`, not
    // `??`, so the fallback actually fires (bit us once already, see the
    // build-failure fix commit).
    _client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  }
  return _client;
}

let _transporter: nodemailer.Transporter | undefined;
function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      SES: { sesClient: getClient(), SendEmailCommand },
    });
  }
  return _transporter;
}

// @types/nodemailer's Mail.Options doesn't know about the SES transport's
// own extra `ses` option (ConfigurationSetName etc.) even though it's a
// real, documented runtime feature (nodemailer.com/transports/ses) — the
// community types just haven't caught up. Narrow, deliberate `any` here
// rather than losing type-checking on the whole call.
interface SesMailOptions extends nodemailer.SendMailOptions {
  ses?: { ConfigurationSetName?: string };
}

async function send(
  input: SendEmailInput,
  opts: { fromEnvVar: string; configurationSetEnvVar: string }
): Promise<{ providerMessageId: string }> {
  // requireEnv() calls happen IN HERE, not at the sendTransactional/
  // sendMarketing call site below — those are plain (non-async) arrow
  // functions, so a requireEnv() throw there would throw synchronously
  // instead of rejecting the returned promise, breaking every
  // Promise.allSettled-based caller (lib/broadcasts.ts, the "send test
  // email" route) with an uncaught exception instead of a per-recipient
  // failure. Resolving them inside this async function turns that throw
  // into an ordinary rejection like any other send failure.
  const from = requireEnv(opts.fromEnvVar);
  const configurationSet = requireEnv(opts.configurationSetEnvVar);

  // Explicit input.replyTo wins; otherwise fall back to the account-wide
  // setting (/admin/settings/contact) — one DB read per send, acceptable
  // for our volume and simpler than threading the setting through every
  // call site.
  const replyTo = input.replyTo ?? (await getOrgSettings()).replyToEmail ?? undefined;

  const mailOptions: SesMailOptions = {
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo,
    attachments: input.attachments,
    headers: input.listUnsubscribeHeader
      ? {
          "List-Unsubscribe": input.listUnsubscribeHeader,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
    ses: { ConfigurationSetName: configurationSet },
  };
  const info = (await getTransporter().sendMail(mailOptions)) as { messageId?: string };

  const messageId = info.messageId;
  if (!messageId) throw new Error("SES did not return a MessageId");
  return { providerMessageId: messageId };
}

export const sesProvider: EmailProvider = {
  sendTransactional: (input) =>
    send(input, {
      fromEnvVar: "SES_FROM_TRANSACTIONAL",
      configurationSetEnvVar: "SES_CONFIGURATION_SET_TRANSACTIONAL",
    }),
  sendMarketing: (input) =>
    send(input, {
      fromEnvVar: "SES_FROM_MARKETING",
      configurationSetEnvVar: "SES_CONFIGURATION_SET_MARKETING",
    }),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { EmailProvider, SendEmailInput } from "./provider";

// Two logically separate channels on the SAME SES account/domain, per
// docs/PLAN.md: different Configuration Sets so a marketing complaint spike
// can't drag down the reputation of the transactional channel that
// delivers the QR ticket. Create both Configuration Sets in the SES console
// before going live — see docs/SES_SETUP.md.

// Lazy singleton, not a top-level `const client = new SESv2Client(...)`.
// Building on Vercel calls Next's page-data-collection step for every
// route, which imports this module even for routes that never send an
// email at build time — constructing the client eagerly meant a blank
// AWS_REGION broke the *build*, not just runtime sends. Also: an env var
// that exists but is left blank in Vercel's UI is `""`, not `undefined`,
// so `??` doesn't fall back — use `||` for the same reason.
let _client: SESv2Client | undefined;
function getClient(): SESv2Client {
  if (!_client) {
    _client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  }
  return _client;
}

async function send(
  input: SendEmailInput,
  opts: { from: string; configurationSet: string }
): Promise<{ providerMessageId: string }> {
  const headers = input.listUnsubscribeHeader
    ? [
        { Name: "List-Unsubscribe", Value: input.listUnsubscribeHeader },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ]
    : undefined;

  const command = new SendEmailCommand({
    FromEmailAddress: opts.from,
    ConfigurationSetName: opts.configurationSet,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.text, Charset: "UTF-8" },
          ...(input.html ? { Html: { Data: input.html, Charset: "UTF-8" } } : {}),
        },
        Headers: headers,
      },
    },
  });

  const res = await getClient().send(command);
  if (!res.MessageId) throw new Error("SES did not return a MessageId");
  return { providerMessageId: res.MessageId };
}

export const sesProvider: EmailProvider = {
  sendTransactional: (input) =>
    send(input, {
      from: requireEnv("SES_FROM_TRANSACTIONAL"),
      configurationSet: requireEnv("SES_CONFIGURATION_SET_TRANSACTIONAL"),
    }),
  sendMarketing: (input) =>
    send(input, {
      from: requireEnv("SES_FROM_MARKETING"),
      configurationSet: requireEnv("SES_CONFIGURATION_SET_MARKETING"),
    }),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

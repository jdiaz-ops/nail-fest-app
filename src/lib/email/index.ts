import { sesProvider } from "./ses";
import { resendProvider } from "./resend";
import type { EmailProvider } from "./provider";

// The one place a provider swap gets wired in. Defaults to SES (unchanged
// from before Resend existed, so this is a no-op for the current Amazon
// setup) — set EMAIL_PROVIDER=resend in .env/Vercel to flip everything
// (transactional AND marketing, see resend.ts's own comment) to Resend
// instead, no other code change needed. See docs/RESEND_SETUP.md for the
// "SES never approved / got denied" playbook this exists for.
export const emailProvider: EmailProvider = process.env.EMAIL_PROVIDER === "resend" ? resendProvider : sesProvider;

export type { SendEmailInput } from "./provider";

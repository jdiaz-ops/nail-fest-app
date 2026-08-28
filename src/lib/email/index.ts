import { sesProvider } from "./ses";
import type { EmailProvider } from "./provider";

// The one place a provider swap gets wired in.
export const emailProvider: EmailProvider = sesProvider;

export type { SendEmailInput } from "./provider";

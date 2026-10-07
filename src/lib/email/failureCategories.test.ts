import { describe, expect, it } from "vitest";
import { categorizeEmailFailure } from "./failureCategories";

describe("categorizeEmailFailure", () => {
  it("bounces: hard vs soft vs no detail", () => {
    expect(categorizeEmailFailure("BOUNCED", "Permanent/General — 550 5.1.1 The email account that you tried to reach does not exist")).toBe("address");
    expect(categorizeEmailFailure("BOUNCED", "Transient/MailboxFull — 452 4.2.2 Mailbox full")).toBe("mailbox");
    expect(categorizeEmailFailure("BOUNCED", null)).toBe("bounce_unknown");
  });
  it("complaints are their own group, never retried", () => {
    expect(categorizeEmailFailure("COMPLAINED", null)).toBe("complaint");
  });
  it("provider refusals: transient vs bad address vs unknown", () => {
    expect(categorizeEmailFailure("FAILED", "Resend error: Too many requests. You can only make 2 requests per second.")).toBe("transient");
    expect(categorizeEmailFailure("FAILED", "Resend error: You have reached your daily email sending quota.")).toBe("transient");
    expect(categorizeEmailFailure("FAILED", "Resend error: Invalid `to` field. The email address needs to follow the `email@example.com` format.")).toBe("address");
    expect(categorizeEmailFailure("FAILED", "SES did not return a MessageId")).toBe("unknown");
    expect(categorizeEmailFailure("FAILED", null)).toBe("unknown");
  });
  it("a delivered/opened row is not a failure", () => {
    expect(categorizeEmailFailure("DELIVERED", null)).toBeNull();
  });
});

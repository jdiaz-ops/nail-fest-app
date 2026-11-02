import { afterEach, describe, expect, it } from "vitest";
import { paypalCheckoutConfig } from "./paypal";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("PayPal in the checkout", () => {
  it("is hidden (2026-11-02), even with live credentials loaded", () => {
    process.env.PAYPAL_ENV = "live";
    process.env.PAYPAL_CLIENT_ID = "live-client";
    process.env.PAYPAL_CLIENT_SECRET = "live-secret";
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "live-client";
    expect(paypalCheckoutConfig()).toBeNull();
  });
});

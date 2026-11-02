import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CHECKOUT_RESUME_DAYS, checkoutResumeToken, readCheckoutResumeToken } from "./checkoutResume";

const NOW = new Date("2026-11-02T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.APP_SECRET_KEY;
  process.env.APP_SECRET_KEY = "solo-prueba";
});
afterEach(() => {
  process.env.APP_SECRET_KEY = saved;
});

describe("the abandoned-cart reminder's link back into the checkout", () => {
  it("names its registration, signed", () => {
    const token = checkoutResumeToken("reg_123", NOW);
    expect(token.split(".")).toHaveLength(3);
    expect(readCheckoutResumeToken(token, NOW)).toBe("reg_123");
  });

  it("is good for 30 days, then expires", () => {
    const token = checkoutResumeToken("reg_123", NOW);
    expect(readCheckoutResumeToken(token, new Date(NOW.getTime() + (CHECKOUT_RESUME_DAYS - 1) * DAY))).toBe("reg_123");
    expect(readCheckoutResumeToken(token, new Date(NOW.getTime() + (CHECKOUT_RESUME_DAYS + 1) * DAY))).toBeNull();
  });

  it("refuses one tampered with or signed with another key", () => {
    const token = checkoutResumeToken("reg_123", NOW);
    const [, expires, signature] = token.split(".");
    expect(readCheckoutResumeToken(`reg_999.${expires}.${signature}`, NOW)).toBeNull();
    expect(readCheckoutResumeToken(`${token}x`, NOW)).toBeNull();
    process.env.APP_SECRET_KEY = "otra";
    expect(readCheckoutResumeToken(token, NOW)).toBeNull();
  });

  it("refuses anything not shaped like one", () => {
    expect(readCheckoutResumeToken("", NOW)).toBeNull();
    expect(readCheckoutResumeToken("reg_123", NOW)).toBeNull();
    expect(readCheckoutResumeToken("a.b", NOW)).toBeNull();
    expect(readCheckoutResumeToken("a.b.c.d", NOW)).toBeNull();
  });

  it("reads nothing without APP_SECRET_KEY", () => {
    const token = checkoutResumeToken("reg_123", NOW);
    delete process.env.APP_SECRET_KEY;
    expect(readCheckoutResumeToken(token, NOW)).toBeNull();
  });
});

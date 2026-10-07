import { describe, expect, it } from "vitest";
import { categorizeWhatsAppFailure, extractMetaErrorCode } from "./failureCategories";

describe("categorizeWhatsAppFailure", () => {
  it("reads the code from both shapes this app stores", () => {
    expect(extractMetaErrorCode("[131026] Message undeliverable — Message Undeliverable.")).toBe(131026);
    expect(extractMetaErrorCode('WhatsApp Cloud API 400 on 123/messages: {"error":{"message":"(#131026) Message Undeliverable","type":"OAuthException","code":131026}}')).toBe(131026);
    expect(extractMetaErrorCode("fetch failed")).toBeNull();
    expect(extractMetaErrorCode(null)).toBeNull();
  });

  it("buckets Meta's codes into the four plans of action", () => {
    expect(categorizeWhatsAppFailure("[131026] Message undeliverable")).toBe("number");
    expect(categorizeWhatsAppFailure("[131049] This message was not delivered to maintain healthy ecosystem engagement.")).toBe("meta");
    expect(categorizeWhatsAppFailure("[130472] User's number is part of an experiment")).toBe("meta");
    expect(categorizeWhatsAppFailure('WhatsApp Cloud API 400 on x: {"error":{"code":132000,"message":"Number of parameters does not match"}}')).toBe("template");
    expect(categorizeWhatsAppFailure("[132015] Template is paused")).toBe("template");
    expect(categorizeWhatsAppFailure("[130429] Rate limit hit")).toBe("transient");
    expect(categorizeWhatsAppFailure("[131056] (Business Account, Consumer Account) pair rate limit hit")).toBe("transient");
    expect(categorizeWhatsAppFailure("[131000] Something went wrong")).toBe("transient");
  });

  it("splits 'invalid parameter' by what the detail blames", () => {
    expect(categorizeWhatsAppFailure('WhatsApp Cloud API 400 on x: {"error":{"code":131009,"message":"Parameter value is not valid","error_data":{"details":"Invalid phone number: 57300"}}}')).toBe("number");
    expect(categorizeWhatsAppFailure('WhatsApp Cloud API 400 on x: {"error":{"code":100,"message":"Invalid parameter","error_data":{"details":"Param text cannot have new-line/tab characters"}}}')).toBe("template");
  });

  it("treats a request that never got an answer as transient, and the rest as unknown", () => {
    expect(categorizeWhatsAppFailure("fetch failed")).toBe("transient");
    expect(categorizeWhatsAppFailure("WhatsApp Cloud API 503 on x: {}")).toBe("transient");
    expect(categorizeWhatsAppFailure("something odd")).toBe("unknown");
    expect(categorizeWhatsAppFailure(null)).toBe("unknown");
  });
});

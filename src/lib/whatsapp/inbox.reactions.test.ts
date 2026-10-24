import { describe, expect, it, vi } from "vitest";

const { findFirst, updateMany } = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { whatsAppMessage: { findFirst, updateMany } } }));
vi.mock("@/lib/consent", () => ({ revokeConsent: vi.fn() }));
vi.mock("@/lib/contactHygiene", () => ({ markMetaBlocked: vi.fn(), markPhoneInvalid: vi.fn() }));
vi.mock("./index", () => ({ whatsappProvider: {} }));

import { describeInbound, processWebhookPayload } from "./inbox";

const statusPayload = (status: string) => ({
  entry: [{ changes: [{ value: { statuses: [{ id: "wamid.reaction", status, recipient_id: "573134328912", timestamp: "1", errors: [{ code: 131009, title: "Parameter value is not valid" }] }] } }] }],
});

describe("a reaction the team left, in the webhook", () => {
  it("comes off the message when WhatsApp says it failed", async () => {
    findFirst.mockResolvedValue(null);
    await processWebhookPayload(statusPayload("failed") as never);
    expect(updateMany).toHaveBeenCalledWith({ where: { staffReactionProviderId: "wamid.reaction", staffReaction: { not: null } }, data: { staffReaction: null } });
  });

  it("stays when it went out", async () => {
    findFirst.mockResolvedValue(null);
    updateMany.mockClear();
    await processWebhookPayload(statusPayload("sent") as never);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("keeps describing the person's own reactions the same way", () => {
    expect(describeInbound({ id: "w", from: "57300", timestamp: "1", type: "reaction", reaction: { message_id: "x", emoji: "❤️" } } as never).body).toBe("Reaccionó ❤️ a un mensaje");
    expect(describeInbound({ id: "w", from: "57300", timestamp: "1", type: "reaction", reaction: { message_id: "x" } } as never).body).toBe("Quitó su reacción a un mensaje");
  });
});

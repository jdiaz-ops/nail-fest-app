import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplate = vi.hoisted(() => vi.fn());
const recordOutboundMessage = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  broadcast: null as Record<string, unknown> | null,
  people: [] as { id: string; phone: string | null; firstName: string }[],
  registrations: [] as { personId: string; eventId: string; qrToken: string; customFields?: Record<string, unknown> }[],
}));

vi.mock("./index", () => ({ whatsappProvider: { sendTemplate } }));
vi.mock("./inbox", () => ({ recordOutboundMessage }));
vi.mock("@/lib/qstash", () => ({ publishChunkContinuation: async () => null, scheduleWhatsAppBroadcastSend: async () => null, QSTASH_MAX_DELAY_MS: 7 * 24 * 3600 * 1000, CHUNK_WATCHDOG_SECONDS: 90, CHUNK_LOCK_SECONDS: 70 }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: async () => ({ timezone: "America/Bogota", language: "es" }) }));
vi.mock("@/lib/consent", () => ({
  bulkActiveConsent: async (ids: string[]) => new Set(ids),
  hasActiveConsent: async () => true,
}));
vi.mock("@/lib/segments/builder", () => ({ resolveSegment: async () => state.people }));
vi.mock("@/lib/broadcastRecipients", () => ({ resolveEventBroadcastRecipients: async () => [] }));
vi.mock("@/lib/db", () => ({
  db: {
    whatsAppBroadcast: {
      findUniqueOrThrow: async () => state.broadcast,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.broadcast!, data),
      updateMany: async () => ({ count: 1 }),
    },
    $queryRaw: async () => [],
    segmentDefinition: { findUniqueOrThrow: async () => ({ id: "seg", filter: {} }) },
    person: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => state.people.filter((p) => where.id.in.includes(p.id)) },
    whatsAppMessage: { findMany: async () => [] },
    registration: {
      findMany: async ({ where }: { where: { eventId: string; personId: { in: string[] } } }) =>
        state.registrations.filter((r) => r.eventId === where.eventId && where.personId.in.includes(r.personId)),
    },
    label: { update: async () => ({}) },
  },
}));

import { duplicatePhoneRecipients, previewSegmentRecipients, sendWhatsAppBroadcast } from "./broadcasts";

const TICKET_URL = "https://nailfest.lat/api/ticket-pdf/{{1}}";

function makeBroadcast(buttons: unknown[], ticketEventId: string | null) {
  return {
    id: "b1",
    segmentId: "seg",
    eventId: null,
    event: null,
    segment: { id: "seg", filter: {} },
    ticketEventId,
    variableMapping: { "1": "NOMBRE" },
    assignLabelId: null,
    recipientPersonIds: null,
    cursor: 0,
    templateId: "t1",
    template: { id: "t1", name: "tu_entrada", language: "es", status: "APPROVED", bodyText: "Hola {{1}}", variableCount: 1, buttons },
  };
}

beforeEach(() => {
  sendTemplate.mockReset().mockResolvedValue({ providerMessageId: "wamid.1" });
  recordOutboundMessage.mockReset();
  state.people = [
    { id: "p1", phone: "+573001112222", firstName: "María" },
    { id: "p2", phone: "+573003334444", firstName: "Karen" },
  ];
  state.registrations = [{ personId: "p1", eventId: "cucuta", qrToken: "reg1.sig" }];
});

describe("difusión with a 'Ver mi entrada' button", () => {
  it("fills each person's own entrada, at the button's real position", async () => {
    state.broadcast = makeBroadcast(
      [
        { type: "QUICK_REPLY", text: "Gracias" },
        { type: "URL", text: "Ver mi entrada", url: TICKET_URL },
      ],
      "cucuta"
    );
    const result = await sendWhatsAppBroadcast("b1");

    expect(result).toMatchObject({ sent: 1, skippedNoTicket: 1, failed: 0 });
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+573001112222", variables: ["María"], buttonUrlParam: "reg1.sig", buttonIndex: 1 })
    );
    expect(recordOutboundMessage.mock.calls[0]![0].body).toContain("https://nailfest.lat/api/ticket-pdf/reg1.sig");
  });

  it("refuses to send when no event was chosen for the button", async () => {
    state.broadcast = makeBroadcast([{ type: "URL", text: "Ver mi entrada", url: TICKET_URL }], null);
    await expect(sendWhatsAppBroadcast("b1")).rejects.toThrow(/evento/);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("previews who won't receive it for lack of an entrada", async () => {
    expect(await previewSegmentRecipients("seg", "cucuta")).toMatchObject({ total: 2, eligible: 1, noTicket: 1 });
    expect(await previewSegmentRecipients("seg")).toMatchObject({ total: 2, eligible: 2, noTicket: 0 });
  });
});

describe("difusión without that button", () => {
  it("sends to everyone as before, with no button parameter", async () => {
    state.broadcast = makeBroadcast([{ type: "URL", text: "Ver evento", url: "https://nailfest.lat/cucuta-2026" }], null);
    const result = await sendWhatsAppBroadcast("b1");
    expect(result).toMatchObject({ sent: 2, skippedNoTicket: 0 });
    for (const [call] of sendTemplate.mock.calls) {
      expect(call.buttonUrlParam).toBeUndefined();
    }
  });
});

describe("one message per WhatsApp number", () => {
  const everyone = () => true;

  it("treats every way of writing the same number as one", () => {
    const people = [
      { id: "a", phone: "+57 313 405 8607" },
      { id: "b", phone: "573134058607" },
      { id: "c", phone: "3134058607" },
      { id: "d", phone: "+573001112222" },
    ];
    expect([...duplicatePhoneRecipients(people, everyone)]).toEqual(["b", "c"]);
  });

  it("never lets a contact that wouldn't receive it use up the number", () => {
    const people = [
      { id: "noConsent", phone: "+573134058607" },
      { id: "ok", phone: "+573134058607" },
    ];
    expect(duplicatePhoneRecipients(people, (id) => id === "ok").size).toBe(0);
  });

  it("with an entrada button, sends to each different cédula sharing a phone", () => {
    const people = [
      { id: "mayra1", phone: "+584127136846" },
      { id: "mayra2", phone: "+584127136846" },
      { id: "liliana", phone: "+584247056102" },
      { id: "wilmer", phone: "+584247056102" },
    ];
    const holders = new Map([
      ["mayra1", "60412382"],
      ["mayra2", "60412382"],
      ["liliana", "20424688"],
      ["wilmer", "21342022"],
    ]);
    expect([...duplicatePhoneRecipients(people, everyone, holders)]).toEqual(["mayra2"]);
  });

  it("sends once per number and says how many were left out", async () => {
    state.people = [
      { id: "p1", phone: "+573001112222", firstName: "Mayra" },
      { id: "p2", phone: "+57 300 111 2222", firstName: "Mayra" },
      { id: "p3", phone: "+573003334444", firstName: "Karen" },
    ];
    state.broadcast = makeBroadcast([], null);
    expect(await previewSegmentRecipients("seg")).toMatchObject({ total: 3, eligible: 2, duplicatePhone: 1 });
    const result = await sendWhatsAppBroadcast("b1");
    expect(result).toMatchObject({ sent: 2, skippedDuplicatePhone: 1 });
    expect(sendTemplate.mock.calls.map(([c]) => c.to)).toEqual(["+573001112222", "+573003334444"]);
  });

  it("with the entrada button, same cédula on one number gets a single entrada", async () => {
    state.people = [
      { id: "p1", phone: "+573001112222", firstName: "Mayra" },
      { id: "p2", phone: "+573001112222", firstName: "Mayra" },
      { id: "p3", phone: "+573001112222", firstName: "Hija" },
    ];
    state.registrations = [
      { personId: "p1", eventId: "cucuta", qrToken: "reg1.sig", customFields: { cedula: "60.412.382" } },
      { personId: "p2", eventId: "cucuta", qrToken: "reg2.sig", customFields: { cedula: "60412382" } },
      { personId: "p3", eventId: "cucuta", qrToken: "reg3.sig", customFields: { cedula: "1090450263" } },
    ];
    state.broadcast = makeBroadcast([{ type: "URL", text: "Ver mi entrada", url: TICKET_URL }], "cucuta");
    const result = await sendWhatsAppBroadcast("b1");
    expect(result).toMatchObject({ sent: 2, skippedDuplicatePhone: 1 });
    expect(sendTemplate.mock.calls.map(([c]) => c.buttonUrlParam)).toEqual(["reg1.sig", "reg3.sig"]);
  });
});

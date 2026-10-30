import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import type { Event } from "@prisma/client";
import { defaultShareText } from "./confirmation";

describe("«Compartir por WhatsApp»'s message", () => {
  it("by default, the congress's name without its date, its day and how it's held", () => {
    const event = { name: "Manicuristas Imparables - 27 Junio 2027", publicName: null, startsAt: new Date("2027-06-27T13:00:00Z"), endsAt: new Date("2027-06-28T00:00:00Z"), scheduleDays: null } as unknown as Event;
    expect(defaultShareText(event, "America/Bogota")).toBe("Mira este congreso para manicuristas: Manicuristas Imparables, 27 de junio, 100% en vivo.");
  });
});

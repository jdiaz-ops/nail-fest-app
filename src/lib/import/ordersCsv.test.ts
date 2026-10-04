import { describe, expect, it } from "vitest";
import { parseOrdersCsv, parseTicketTailorDate } from "./ordersCsv";

describe("parseTicketTailorDate", () => {
  it("reads Ticket Tailor's order and event-start formats as local wall-clock time", () => {
    expect(parseTicketTailorDate("Jun 8, 2026 12:29 AM")).toBe("2026-06-08T00:29");
    expect(parseTicketTailorDate("Aug 2, 2026 3:47 PM")).toBe("2026-08-02T15:47");
    expect(parseTicketTailorDate("Jun 17, 2026 12:05 PM")).toBe("2026-06-17T12:05");
    expect(parseTicketTailorDate("Sat Aug 1, 2026 10:00 AM")).toBe("2026-08-01T10:00");
    expect(parseTicketTailorDate("2026-06-08 00:29:00")).toBe("2026-06-08T00:29");
    expect(parseTicketTailorDate("ayer")).toBeNull();
  });
});

describe("parseOrdersCsv", () => {
  const csv = [
    "Order ID,Order date,Tickets purchased,Order cancelled,Event name,Event start,Email,Número de cédula - o - NIT",
    '1,"Jun 18, 2026 9:00 AM",2,0,"Nail Fest Pereira","Sat Aug 1, 2026 10:00 AM",Ana@X.com,0123456',
    '2,"Jun 17, 2026 8:00 PM",1,0,"Nail Fest Pereira","Sat Aug 1, 2026 10:00 AM",ana@x.com,',
    '3,"Jun 20, 2026 1:00 PM",1,1,"Nail Fest Pereira","Sat Aug 1, 2026 10:00 AM",cancel@x.com,',
    '4,"Jun 21, 2026 1:00 PM",1,0,"Nail Fest Pereira","Sat Aug 1, 2026 10:00 AM",,',
  ].join("\n");

  it("keeps each email's earliest order, skipping cancelled orders and rows without email", () => {
    const r = parseOrdersCsv(csv);
    expect(r.entries).toEqual([{ email: "ana@x.com", cedula: "123456", orderedAtLocal: "2026-06-17T20:00" }]);
    expect(r.orders).toBe(4);
    expect(r.tickets).toBe(4);
    expect(r.skippedCancelled).toBe(1);
    expect(r.skippedNoEmail).toBe(1);
    expect(r.eventNames).toEqual(["Nail Fest Pereira"]);
    expect(r.eventStartLocal).toBe("2026-08-01T10:00");
    expect(r.missingDateColumn).toBe(false);
  });

  it("flags a file with no Order date column (e.g. the doorlist export)", () => {
    expect(parseOrdersCsv("Name,Ticket type,Email address\nAna,General,a@x.com").missingDateColumn).toBe(true);
  });
});

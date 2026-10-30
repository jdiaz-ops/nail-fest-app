import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { eventDays, inPersonCalendarEvent, longDates, mapsUrl } from "./confirmation";
import { defaultInvite, defaultTips, nailFestConfirmationEmail, type NailFestConfirmation } from "./confirmationEmail";

const TZ = "America/Bogota";
const at = (iso: string) => new Date(iso);

describe("the event's days", () => {
  it("says two days in a row with «y», more with «del … al»", () => {
    expect(longDates({ startsAt: at("2026-11-07T15:00:00Z"), endsAt: at("2026-11-08T22:00:00Z"), scheduleDays: null }, TZ)).toBe(
      "Sábado 7 y domingo 8 de noviembre"
    );
    expect(longDates({ startsAt: at("2026-11-06T15:00:00Z"), endsAt: at("2026-11-08T22:00:00Z"), scheduleDays: null }, TZ)).toBe(
      "Del viernes 6 al domingo 8 de noviembre"
    );
  });

  it("names one day alone, and both months when it crosses one", () => {
    expect(longDates({ startsAt: at("2026-11-07T15:00:00Z"), endsAt: at("2026-11-07T23:00:00Z"), scheduleDays: null }, TZ)).toBe("Sábado 7 de noviembre");
    expect(longDates({ startsAt: at("2026-10-31T15:00:00Z"), endsAt: at("2026-11-01T22:00:00Z"), scheduleDays: null }, TZ)).toBe(
      "Sábado 31 de octubre y domingo 1 de noviembre"
    );
  });

  it("takes each day's hours from the schedule, in order", () => {
    const scheduleDays = [
      { opensAt: "2026-11-08T15:00:00.000Z", closesAt: "2026-11-08T22:00:00.000Z" },
      { opensAt: "2026-11-07T15:00:00.000Z", closesAt: "2026-11-08T00:00:00.000Z" },
    ];
    const event = { startsAt: at("2026-11-07T15:00:00Z"), endsAt: at("2026-11-08T22:00:00Z"), scheduleDays };
    const days = eventDays(event, TZ);
    expect(days.map(([day]) => day)).toEqual(["Sábado 7", "Domingo 8"]);
    expect(days[0]![1]).toMatch(/^10:00 a.\sm. a 7:00 p.\sm.$/);
    expect(longDates(event, TZ)).toBe("Sábado 7 y domingo 8 de noviembre");
  });

  it("without a schedule, from its start one day to its end the other", () => {
    const days = eventDays({ startsAt: at("2026-11-07T15:00:00Z"), endsAt: at("2026-11-08T22:00:00Z"), scheduleDays: null }, TZ);
    expect(days.map(([day]) => day)).toEqual(["Sábado 7", "Domingo 8"]);
    expect(days[0]![1]).toMatch(/^Desde las 10:00/);
    expect(days[1]![1]).toMatch(/^Hasta las 5:00/);
  });
});

describe("the place", () => {
  it("goes to Google Maps when it has a name or an address", () => {
    expect(mapsUrl({ venueName: null, venueAddress: " ", city: "Cúcuta" })).toBeNull();
    const url = mapsUrl({ venueName: "Salón Ventura", venueAddress: "Av. 0 #11-20", city: "Cúcuta" })!;
    expect(new URL(url).searchParams.get("query")).toBe("Salón Ventura, Av. 0 #11-20, Cúcuta");
  });

  it("is in the calendar, with the event's own end or eight hours", () => {
    const event = {
      id: "ev1",
      slug: "cucuta",
      name: "Nail Fest Cúcuta 2026",
      publicName: "Nail Fest Cúcuta",
      startsAt: at("2026-11-07T15:00:00Z"),
      endsAt: null,
      venueName: "Salón Ventura",
      venueAddress: null,
      city: "Cúcuta",
    };
    const c = inPersonCalendarEvent(event);
    expect(c.title).toBe("Nail Fest Cúcuta");
    expect(c.location).toBe("Salón Ventura, Cúcuta");
    expect(c.end.getTime() - c.start.getTime()).toBe(8 * 3_600_000);
  });
});

describe("the email", () => {
  const c: NailFestConfirmation = {
    firstName: "Laura",
    eventName: "Nail Fest Cúcuta",
    city: "Cúcuta",
    dates: "Sábado 7 y domingo 8 de noviembre",
    year: "2026",
    days: [
      ["Sábado 7", "10:00 a. m. a 7:00 p. m."],
      ["Domingo 8", "10:00 a. m. a 5:00 p. m."],
    ],
    venue: { name: "Salón Ventura", address: "Av. 0 #11-20", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n" },
    tickets: [{ qrImageUrl: "https://nailfest.lat/api/ticket-qr/abc.def", holder: "Laura Gómez", label: "Entrada general", code: "ABCD1234" }],
    people: 1,
    pdfAttached: false,
    calendar: { google: "https://calendar.google.com/calendar/render?action=TEMPLATE", ics: "https://nailfest.lat/cucuta/calendario" },
    tips: ["Lleva <tu> lima & esmaltes"],
    asistire: null,
    share: { url: "https://wa.me/?text=hola" },
    helpUrl: "https://wa.me/573001234567",
    instagram: { handle: "@nailfest_co", url: "https://www.instagram.com/nailfest_co" },
    images: { logo: "https://nailfest.lat/logo.png" },
    site: { url: "https://nailfest.lat", host: "nailfest.lat" },
  };

  it("carries her ticket, the place and the event's own «Antes de ir», escaped", () => {
    const { html, text } = nailFestConfirmationEmail(c);
    expect(html).toContain("¡Te esperamos, Laura!");
    expect(html).toContain('src="https://nailfest.lat/api/ticket-qr/abc.def"');
    expect(html).toContain("ABCD1234");
    expect(html).toContain("Cómo llegar");
    expect(html).toContain("Lleva &lt;tu&gt; lima &amp; esmaltes");
    expect(html).toContain("https://wa.me/?text=hola");
    expect(html).not.toContain("Crear mi imagen");
    expect(text).toContain("ABCD1234");
  });

  it("invites her to make her «Asistiré» image when she has a link", () => {
    const { html } = nailFestConfirmationEmail({ ...c, asistire: { url: "https://nailfest.lat/asistire/x.y", image: "https://nailfest.lat/nailfest/asistire-muestra.jpg" } });
    expect(html).toContain("Crear mi imagen");
    expect(html).toContain("https://nailfest.lat/asistire/x.y");
  });

  it("invites a colleague with the event's days", () => {
    expect(defaultInvite("Nail Fest Cúcuta", "Sábado 7 y domingo 8 de noviembre")).toBe(
      "¡Vamos juntas a Nail Fest Cúcuta! Es el sábado 7 y domingo 8 de noviembre y la entrada es gratis. Inscríbete aquí:"
    );
    expect(defaultInvite("Nail Fest Cúcuta", "Del viernes 6 al domingo 8 de noviembre")).toContain("Es del viernes 6 al domingo 8 de noviembre y");
  });

  it("has general tips for one day and for several", () => {
    expect(defaultTips(false)[1]).not.toContain("todos los días");
    expect(defaultTips(true)[1]).toContain("todos los días");
  });
});

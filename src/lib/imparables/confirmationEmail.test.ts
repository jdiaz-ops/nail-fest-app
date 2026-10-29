import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsCalendar, imparablesConfirmationEmail, shareLine, type ImparablesConfirmation } from "./confirmationEmail";

const CALENDAR = {
  uid: "ev_1@nailfest.lat",
  title: "Manicuristas Imparables",
  start: new Date("2027-06-27T08:00:00-05:00"),
  end: new Date("2027-06-27T19:00:00-05:00"),
  description: "Congreso virtual 100% en vivo por Zoom. Tu enlace personal te llega por correo y WhatsApp 30 minutos antes de empezar.",
  location: "Zoom (tu enlace te llega por correo y WhatsApp)",
  url: "https://nailfest.lat/manicuristas-imparables-2027",
};

const base = (over: Partial<ImparablesConfirmation> = {}): ImparablesConfirmation => ({
  firstName: "Laura",
  eventName: "Manicuristas Imparables",
  date: "Domingo 27 de junio de 2027",
  hours: "8:00 a. m. a 7:00 p. m.",
  zone: "hora Colombia",
  day: "27 de junio",
  start: "8:00 a. m.",
  linkMinutesBefore: 30,
  oneDay: true,
  purchase: { stage: "Etapa Creyente", paid: "$90.000" },
  code: "7KQ2M9XA",
  calendar: { google: googleCalendarUrl(CALENDAR), ics: "https://nailfest.lat/manicuristas-imparables-2027/calendario" },
  share: { line: shareLine("$90.000", "$120.000"), url: "https://wa.me/?text=hola" },
  helpUrl: "https://wa.me/573001234567",
  speakers: ["Jimena", "Paula", "Cristina", "Alejandro", "Karen", "Fabi", "Juan", "Oskar"].map((name) => ({ name, photoUrl: `https://nailfest.lat/imparables/${name}.jpg` })),
  panel: true,
  images: { header: "https://nailfest.lat/imparables/correo-cabecera.png", logo: "https://nailfest.lat/logo.png" },
  site: { url: "https://nailfest.lat", host: "nailfest.lat" },
  ...over,
});

describe("Manicuristas Imparables' confirmation email", () => {
  it("says hello, her ticket — when, where, what she paid, her code — and her calendar", () => {
    const { html, text } = imparablesConfirmationEmail(base());
    expect(html).toContain("¡Lo lograste, Laura!");
    expect(html).toContain("CUPO CONFIRMADO");
    expect(html).toContain("Etapa Creyente · $90.000");
    expect(html).toContain("7KQ2M9XA");
    expect(html).toContain("8:00 a. m. a 7:00 p. m. · hora Colombia");
    expect(html).toContain("calendar.google.com");
    expect(html).toContain("https://nailfest.lat/manicuristas-imparables-2027/calendario");
    expect(text).toContain("Código: 7KQ2M9XA");
    expect(text).toContain("Tu compra: Etapa Creyente · $90.000");
  });

  it("tells what happens now in five steps, with the day and the hour", () => {
    const { html, text } = imparablesConfirmationEmail(base());
    for (const step of ["Guarda este correo", "Te escribimos por WhatsApp", "El 27 de junio, 30 minutos antes", "Conéctate a las 8:00 a. m.", "30 días de repetición"]) {
      expect(html).toContain(step);
    }
    expect(html).toContain("Hora Colombia: si estás en otro país, ajusta la hora.");
    expect(text).toContain("4. Conéctate a las 8:00 a. m. Hora Colombia:");
  });

  it("shows who's waiting, four to a row, and the colleague to share it with", () => {
    const { html } = imparablesConfirmationEmail(base());
    expect(html).toContain("8 conferencistas y un panel, en un solo día");
    expect(html.match(/imparables\/(Jimena|Paula|Cristina|Alejandro|Karen|Fabi|Juan|Oskar)\.jpg/g)).toHaveLength(8);
    expect(html).toContain("Hoy está a $90.000 y luego sube a $120.000: compartirle esto es un buen regalo.");
    expect(html).toContain("Escríbenos por WhatsApp");
  });

  it("does without what it doesn't have: her name, a purchase, the speakers, the team's WhatsApp", () => {
    const { html } = imparablesConfirmationEmail(base({ firstName: "", purchase: null, speakers: [], helpUrl: null }));
    expect(html).toContain("¡Lo lograste!");
    expect(html).not.toContain("Tu compra");
    expect(html).not.toContain("Quiénes te esperan");
    expect(html).not.toContain("Escríbenos por WhatsApp");
  });

  it("escapes what comes from people", () => {
    const { html } = imparablesConfirmationEmail(base({ firstName: "<b>Ana</b>" }));
    expect(html).toContain("¡Lo lograste, &lt;b&gt;Ana&lt;/b&gt;!");
    expect(html).not.toContain("<b>Ana</b>");
  });

  it("with no price after today's, only the gift", () => {
    expect(shareLine("$150.000", null)).toBe("Compartirle esto es un buen regalo.");
  });
});

describe("her calendar", () => {
  it("Google Calendar's link carries the event in UTC", () => {
    const url = new URL(googleCalendarUrl(CALENDAR));
    expect(url.searchParams.get("dates")).toBe("20270627T130000Z/20270628T000000Z");
    expect(url.searchParams.get("text")).toBe("Manicuristas Imparables");
  });

  it("the .ics is RFC 5545: CRLF lines no longer than 75 octets, its text escaped, a reminder an hour before", () => {
    const ics = icsCalendar(CALENDAR, new Date("2026-10-29T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20270627T130000Z\r\n");
    expect(ics).toContain("DTEND:20270628T000000Z\r\n");
    expect(ics).toContain("TRIGGER:-PT1H");
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:Congreso virtual 100% en vivo por Zoom. Tu enlace personal te llega por correo y WhatsApp 30 minutos antes de empezar.\\nhttps://nailfest.lat/manicuristas-imparables-2027");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(unfolded).toContain("LOCATION:Zoom (tu enlace te llega por correo y WhatsApp)");
  });
});

import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { landingBlockSchema } from "@/lib/landingBlocks/schema";
import { parseLandingBlocks, type AgendaLandingBlock, type LandingBlock } from "@/lib/landingBlocks/types";
import { castLine, castOf, coverOf, introOf, isPanelCard, namesIn, panelGuestsOf, panelOf } from "./blocks";
import { agendaInstant, coverName, dayEnd, eventWhen, readClock } from "./schedule";
import { dollars, pesos, salesState, saving, stageLine, stagePill, stagesSummary, untilDay, type StageTicketType } from "./stages";
import { splitTagline } from "./tagline";
import { IMPARABLES_BLOCKS, IMPARABLES_FIELDS, IMPARABLES_GROUP_PHOTO, IMPARABLES_PANELISTS, IMPARABLES_SPEAKERS, IMPARABLES_STAGES } from "./template";

const TZ = "America/Bogota";
const at = (iso: string) => new Date(iso);
const STARTS = at("2027-06-27T09:00:00-05:00");

// The template's stages as their ticket types (pricing.ts's loadStages): each one's paid tickets, and when it sold out.
const stages = (paid: number[] = [], soldOutAt: (string | null)[] = []): StageTicketType[] =>
  IMPARABLES_STAGES.map((s, i) => ({
    id: `t${i}`,
    name: s.name,
    slug: s.slug,
    price: s.price,
    status: "ON_SALE",
    hideUntil: null,
    hideAfter: at(s.closesAt),
    cap: s.cap,
    paid: paid[i] ?? 0,
    soldOutAt: soldOutAt[i] ? at(soldOutAt[i]!) : null,
    note: s.note,
    order: i,
  }));
const sales = (types: StageTicketType[], iso: string) => salesState(types, at(iso), STARTS);
// The line keeps "18 de abril" and "200 cupos" together with non-breaking spaces.
const line = (state: ReturnType<typeof salesState>) => stageLine(state, TZ)?.replace(/\u00a0/g, " ");

// getActiveStage (pricing.ts) is this rule on what the database has (pricing.test.ts covers what it counts).
describe("getActiveStage: the first stage whose date hasn't come and whose cap isn't reached (America/Bogota)", () => {
  it("before any sale: Etapa Creyente, $90.000, its 200 places left, Etapa Decidida next", () => {
    const state = sales(stages(), "2026-10-29T10:00:00-05:00");
    expect(state.mode).toBe("sale");
    expect([state.active?.slug, state.current?.price, state.remaining, state.next?.name]).toEqual(["creyente", 90_000, 200, "Etapa Decidida"]);
    expect(state.previous).toBeNull();
    expect(state.countdown).toEqual({ to: at("2027-04-18T23:59:00-05:00"), label: "Este precio termina en" });
  });

  it("with 199 Creyente sales, still Creyente with 1 place left; with 200, Etapa Decidida", () => {
    const at199 = sales(stages([199]), "2027-02-01T10:00:00-05:00");
    expect([at199.active?.slug, at199.remaining]).toEqual(["creyente", 1]);
    const at200 = sales(stages([200], ["2027-01-31T18:00:00-05:00"]), "2027-02-01T10:00:00-05:00");
    expect([at200.active?.slug, at200.remaining, at200.next?.slug]).toEqual(["decidida", 300, "full"]);
    expect(at200.stages.map((s) => s.state)).toEqual(["soldout", "current", "future"]);
    expect(at200.previous).toEqual({ stage: at200.stages[0], reason: "cap", closedAt: at("2027-01-31T18:00:00-05:00") });
  });

  it("on 18 April at 23:58, Creyente; at 00:00 on the 19th, Decidida — Creyente closed on its date", () => {
    expect(sales(stages(), "2027-04-18T23:58:00-05:00").active?.slug).toBe("creyente");
    const state = sales(stages(), "2027-04-19T00:00:00-05:00");
    expect(state.active?.slug).toBe("decidida");
    expect(state.previous).toEqual({ stage: state.stages[0], reason: "date", closedAt: at("2027-04-18T23:59:00-05:00") });
  });

  it("with 300 Decidida sales before 30 May, the full price", () => {
    const state = sales(stages([120, 300]), "2027-05-10T10:00:00-05:00");
    expect([state.active?.slug, state.current?.price, state.remaining, state.next]).toEqual(["full", 150_000, null, null]);
    expect(state.stages.map((s) => s.state)).toEqual(["past", "soldout", "current"]);
  });

  it("after 30 May, the full price, counting down to the congress", () => {
    const state = sales(stages([150, 40]), "2027-05-31T00:00:00-05:00");
    expect(state.active?.slug).toBe("full");
    expect(state.countdown).toEqual({ to: STARTS, label: "El congreso empieza en" });
  });

  it("on 27 June after 8:00 it's still the full price — and the sale is closed", () => {
    expect(sales(stages(), "2027-06-27T07:59:00-05:00").current?.slug).toBe("full");
    const state = sales(stages(), "2027-06-27T08:30:00-05:00");
    expect(state.active?.slug).toBe("full");
    expect([state.mode, state.current, state.countdown]).toEqual(["closed", null, null]);
  });

  it("keeps a stage that sold out closed though a refund frees a place: the price never goes down", () => {
    expect(sales(stages([199], ["2027-02-10T12:00:00-05:00"]), "2027-02-20T10:00:00-05:00").active?.slug).toBe("decidida");
  });

  it("takes names for a waiting list while the first stage hasn't opened", () => {
    const types = stages().map((t, i) => (i === 0 ? { ...t, hideUntil: at("2027-01-10T00:00:00-05:00") } : t));
    const state = salesState(types, at("2026-12-01T10:00:00-05:00"), STARTS);
    expect([state.mode, state.current, state.next?.slug]).toEqual(["waitlist", null, "creyente"]);
    expect(state.countdown).toEqual({ to: at("2027-01-10T00:00:00-05:00"), label: "La venta abre en" });
  });

  it("leaves out ticket types that aren't on sale", () => {
    const types = [...stages(), { ...stages()[0]!, id: "old", name: "Etapa 3", status: "HIDDEN", order: 9 }];
    expect(sales(types, "2027-02-01T10:00:00-05:00").stages.map((s) => s.name)).toEqual(["Etapa Creyente", "Etapa Decidida", "Precio full"]);
  });

  it("says today's price in dollars too when its ticket has one", () => {
    const withUsd = stages().map((s, i) => ({ ...s, usdCents: [2800, 3500, 4500][i] }));
    expect(sales(withUsd, "2027-02-01T10:00:00-05:00").current?.usdCents).toBe(2800);
    expect(sales(stages(), "2027-02-01T10:00:00-05:00").current?.usdCents).toBeNull();
    expect([dollars(2500), dollars(2550), dollars(100)]).toEqual(["US$25", "US$25.50", "US$1"]);
  });

  it("strikes the full price beside every other stage's", () => {
    const state = sales(stages(), "2027-02-01T10:00:00-05:00");
    expect(state.full?.name).toBe("Precio full");
    expect(state.stages.map((s) => saving(s, state.full))).toEqual([60_000, 30_000, 0]);
  });
});

describe("what the page says about the stages", () => {
  it("under the button, each stage's line: its cap, its date and what comes next", () => {
    expect(line(sales(stages(), "2027-02-01T10:00:00-05:00"))).toBe(
      "Etapa Creyente · 200 cupos a $90.000 o hasta el 18 de abril · luego $120.000"
    );
    expect(line(sales(stages([90]), "2027-04-20T10:00:00-05:00"))).toBe("Etapa Decidida · 300 cupos a $120.000 o hasta el 30 de mayo · luego $150.000");
    expect(line(sales(stages([90, 120]), "2027-06-01T10:00:00-05:00"))).toBe("Precio full · $150.000 · hasta el 27 de junio");
  });

  it("the places left only under 30% of the cap", () => {
    expect(line(sales(stages([140]), "2027-02-01T10:00:00-05:00"))).toMatch(/^Etapa Creyente · 200 cupos/);
    expect(line(sales(stages([141]), "2027-02-01T10:00:00-05:00"))).toBe("Quedan 59 cupos a $90.000 · luego $120.000");
    expect(line(sales(stages([199]), "2027-02-01T10:00:00-05:00"))).toBe("Queda 1 cupo a $90.000 · luego $120.000");
    expect(line(sales(stages([10, 211]), "2027-05-01T10:00:00-05:00"))).toBe("Quedan 89 cupos a $120.000 · luego $150.000");
  });

  it("for 7 days after the stage before closed, a pill: «agotada» at its cap, «cerrada» on its date", () => {
    const soldOut = stages([200], ["2027-03-10T15:00:00-05:00"]);
    expect(stagePill(sales(soldOut, "2027-03-12T10:00:00-05:00"), at("2027-03-12T10:00:00-05:00"))).toBe("Etapa Creyente agotada");
    expect(stagePill(sales(soldOut, "2027-03-18T10:00:00-05:00"), at("2027-03-18T10:00:00-05:00"))).toBeNull();
    expect(stagePill(sales(stages(), "2027-04-25T12:00:00-05:00"), at("2027-04-25T12:00:00-05:00"))).toBe("Etapa Creyente cerrada");
    expect(stagePill(sales(stages(), "2027-04-26T00:00:00-05:00"), at("2027-04-26T00:00:00-05:00"))).toBeNull();
    expect(stagePill(sales(stages(), "2027-02-01T10:00:00-05:00"), at("2027-02-01T10:00:00-05:00"))).toBeNull();
  });

  it("«¿Por qué sube el precio?» tells every stage as the team wrote it", () => {
    expect(stagesSummary(sales(stages(), "2027-02-01T10:00:00-05:00").stages, TZ)).toBe(
      "Etapa Creyente: $90.000, 200 cupos o hasta el 18 de abril, cierre de Nail Fest Cali. Etapa Decidida: $120.000, 300 cupos o hasta el 30 de mayo. Después, $150.000 hasta el día del evento."
    );
  });
});

describe("how prices and dates read", () => {
  it("writes pesos with dots", () => {
    expect(pesos(79_900)).toBe("$79.900");
    expect(pesos(119_900)).toBe("$119.900");
    expect(pesos(1_000_000)).toBe("$1.000.000");
    expect(pesos(900)).toBe("$900");
  });

  it("says the last day a stage's price holds: the day it closes, or the day before when it closes at midnight", () => {
    expect(untilDay(at("2027-04-01T00:00:00-05:00"), TZ)).toBe("31 de marzo");
    expect(untilDay(at("2027-04-18T23:59:00-05:00"), TZ)).toBe("18 de abril");
    expect(untilDay(at("2027-06-27T08:00:00-05:00"), TZ)).toBe("27 de junio");
  });
});

describe("eventWhen", () => {
  it("names the congress's two days and their shared hours", () => {
    const when = eventWhen(
      {
        startsAt: STARTS,
        endsAt: at("2027-06-28T14:00:00-05:00"),
        scheduleDays: [
          { opensAt: "2027-06-28T14:00:00.000Z", closesAt: "2027-06-28T19:00:00.000Z" },
          { opensAt: "2027-06-27T14:00:00.000Z", closesAt: "2027-06-27T19:00:00.000Z" },
        ],
      },
      TZ
    );
    expect(when).toEqual({
      dates: "Domingo 27 y lunes 28 de junio de 2027",
      named: "Domingo 27 y lunes 28 de junio",
      hours: "9:00 a. m. a 2:00 p. m.",
      short: "27 y 28 de junio",
      compact: "27 y 28 de junio de 2027",
      days: ["2027-06-27", "2027-06-28"],
      span: { opensAt: "2027-06-27T14:00:00.000Z", closesAt: "2027-06-27T19:00:00.000Z" },
      ends: ["2027-06-27T19:00:00.000Z", "2027-06-28T19:00:00.000Z"],
    });
  });

  it("names the congress's one day and its hours (2026-10-29): Sunday the 27th, 8:00 a. m. to 7:00 p. m.", () => {
    const when = eventWhen(
      {
        startsAt: at("2027-06-27T08:00:00-05:00"),
        endsAt: at("2027-06-27T19:00:00-05:00"),
        scheduleDays: [{ opensAt: "2027-06-27T13:00:00.000Z", closesAt: "2027-06-28T00:00:00.000Z" }],
      },
      TZ
    );
    expect(when).toEqual({
      dates: "Domingo 27 de junio de 2027",
      named: "Domingo 27 de junio",
      hours: "8:00 a. m. a 7:00 p. m.",
      short: "27 de junio",
      compact: "27 de junio de 2027",
      days: ["2027-06-27"],
      span: { opensAt: "2027-06-27T13:00:00.000Z", closesAt: "2027-06-28T00:00:00.000Z" },
      ends: ["2027-06-28T00:00:00.000Z"],
    });
    // The same from the span alone.
    const span = eventWhen({ startsAt: at("2027-06-27T08:00:00-05:00"), endsAt: at("2027-06-27T19:00:00-05:00") }, TZ);
    expect([span.dates, span.named, span.hours, span.days]).toEqual(["Domingo 27 de junio de 2027", "Domingo 27 de junio", "8:00 a. m. a 7:00 p. m.", ["2027-06-27"]]);
  });

  it("writes the cover's dates as short as they get", () => {
    const one = (startsAt: string, endsAt: string | null) => eventWhen({ startsAt: at(startsAt), endsAt: endsAt ? at(endsAt) : null }, TZ).compact;
    expect(one("2027-06-27T09:00:00-05:00", null)).toBe("27 de junio de 2027");
    expect(one("2027-06-27T09:00:00-05:00", "2027-06-29T14:00:00-05:00")).toBe("27 al 29 de junio de 2027");
    expect(one("2027-06-30T09:00:00-05:00", "2027-07-01T14:00:00-05:00")).toBe("30 de junio y 1 de julio de 2027");
    expect(one("2026-12-31T09:00:00-05:00", "2027-01-01T14:00:00-05:00")).toBe("31 de diciembre de 2026 y 1 de enero de 2027");
  });

  it("reads a single span over two days the same way", () => {
    const when = eventWhen({ startsAt: STARTS, endsAt: at("2027-06-28T14:00:00-05:00") }, TZ);
    expect(when.dates).toBe("Domingo 27 y lunes 28 de junio de 2027");
    expect(when.hours).toBe("9:00 a. m. a 2:00 p. m.");
    expect(when.days).toEqual(["2027-06-27", "2027-06-28"]);
    expect(when.span).toEqual({ opensAt: "2027-06-27T14:00:00.000Z", closesAt: "2027-06-27T19:00:00.000Z" });
    expect(when.ends).toEqual(["2027-06-27T19:00:00.000Z", "2027-06-28T19:00:00.000Z"]);
  });

  it("leaves the hours out when the days keep different ones", () => {
    const when = eventWhen(
      {
        startsAt: STARTS,
        endsAt: null,
        scheduleDays: [
          { opensAt: "2027-06-27T14:00:00.000Z", closesAt: "2027-06-27T19:00:00.000Z" },
          { opensAt: "2027-06-28T15:00:00.000Z", closesAt: "2027-06-28T19:00:00.000Z" },
        ],
      },
      TZ
    );
    expect(when.hours).toBeNull();
    // No shared hours to show in her own hour on the cover; each day still knows when it ends.
    expect(when.span).toBeNull();
    expect(when.ends).toEqual(["2027-06-27T19:00:00.000Z", "2027-06-28T19:00:00.000Z"]);
  });
});

describe("the name on the cover", () => {
  it("leaves out the date the public name carries: it's right below", () => {
    expect(coverName("Manicuristas Imparables - 27 & 28 Junio 2027")).toBe("Manicuristas Imparables");
    expect(coverName("Manicuristas Imparables – junio 2027")).toBe("Manicuristas Imparables");
    expect(coverName("Manicuristas Imparables 2027")).toBe("Manicuristas Imparables");
    expect(coverName("  Manicuristas Imparables ")).toBe("Manicuristas Imparables");
    expect(coverName("Imparables")).toBe("Imparables");
  });
});

describe("how the page reads the blocks", () => {
  it("takes the image before the first section title as the cover's group photo", () => {
    const { cover, rest } = coverOf(IMPARABLES_BLOCKS);
    expect(cover?.url).toBe(IMPARABLES_GROUP_PHOTO);
    expect(rest).toHaveLength(IMPARABLES_BLOCKS.length - 1);
    expect(rest.some((b) => b.type === "image")).toBe(false);
    expect(existsSync(path.join(process.cwd(), "public", IMPARABLES_GROUP_PHOTO))).toBe(true);
    // An image further down is just an image.
    const later = [{ type: "heading", eyebrow: "", title: "x", intro: "" }, { type: "image", url: "/a.jpg", caption: "" }] as LandingBlock[];
    expect(coverOf(later).cover).toBeNull();
  });

  it("tells what the speakers have in common right under the cover, the speakers' section after it", () => {
    const { rest } = coverOf(IMPARABLES_BLOCKS.filter((b) => !b.hidden));
    const { intro, rest: after } = introOf(rest);
    expect(intro?.heading.title).toBe("¿Qué tienen en común todos los conferencistas de Manicuristas Imparables?");
    expect(intro?.text.html).toContain("<strong>dejar de pensar en pequeño</strong>");
    // The speakers' section right after it, with no title of its own.
    expect(after[0]).toMatchObject({ type: "heading", eyebrow: "", title: "" });
    expect(after[1]).toMatchObject({ type: "people" });
    // A section with an eyebrow, or more than a text, is just a section.
    const plain = [{ type: "heading", eyebrow: "Agenda", title: "x", intro: "" }, { type: "text", html: "<p>y</p>" }] as LandingBlock[];
    expect(introOf(plain).intro).toBeNull();
    const more = [{ type: "heading", eyebrow: "", title: "x", intro: "" }, { type: "text", html: "<p>y</p>" }, { type: "text", html: "<p>z</p>" }] as LandingBlock[];
    expect(introOf(more).intro).toBeNull();
  });

  it("names who is under the group photo", () => {
    expect(castLine(IMPARABLES_BLOCKS)).toEqual({
      names: "Cristina Sierra, Jimena Montalban, Paula Chacón, Oskar Garzón, Juan Tenorio, Karen Pinzón, Fabi Pinillo Martínez y Alejandro Salinas",
      also: "con Heidy Aristizábal y el panel «El día que decidí cambiar»",
    });
  });

  it("lists the panel's confirmed guests first, then those still to be announced", () => {
    const panel = panelOf(IMPARABLES_BLOCKS);
    if (!panel) throw new Error("no panel");
    expect(panelGuestsOf(panel.people).map((p) => p.name || p.tag)).toEqual([
      "Maria Carolina Sebastia Sandoval",
      "La que dejó de cobrar barato",
      "La que pasó de su casa a su propio local",
      "La que salió de deudas y ordenó su plata",
    ]);
  });


  it("reads the names on a card as typed", () => {
    expect(namesIn("Fabi, Alejandro Salinas y Oskar")).toEqual(["Fabi", "Alejandro Salinas", "Oskar"]);
    expect(namesIn("Juan Tenorio, Pau y el panel")).toEqual(["Juan Tenorio", "Pau", "el panel"]);
    expect(namesIn("  ")).toEqual([]);
  });
});

describe("the cover's tagline", () => {
  it("parts the pillars (under the group photo), the headline (off the cover) and the line under the name", () => {
    expect(splitTagline(IMPARABLES_FIELDS.subtitle)).toEqual({
      pillars: "<p>Mentalidad · Dinero · Marketing</p>",
      headline: "<p>Deja de pensar en pequeño</p>",
      line: "<p>Inspírate en quienes empezaron desde abajo, con tus mismos miedos, y hoy tienen el negocio y la vida que sueñas. <strong>Aprende cómo lo hicieron y replica sus estrategias para ganar</strong>.</p>",
    });
  });

  it("reads a shorter tagline from its end too", () => {
    expect(splitTagline("<p>Deja de pensar en pequeño.</p><p>Aprende.</p>")).toEqual({
      pillars: null,
      headline: "<p>Deja de pensar en pequeño.</p>",
      line: "<p>Aprende.</p>",
    });
    expect(splitTagline("Una sola línea")).toEqual({ pillars: null, headline: null, line: "Una sola línea" });
  });

  it("counts from the end", () => {
    expect(splitTagline('<p>a</p><p class="x">b</p><p>c</p><p>d</p>')).toEqual({ pillars: '<p class="x">b</p>', headline: "<p>c</p>", line: "<p>d</p>" });
  });
});

describe("the program's hours", () => {
  it("reads the times people write", () => {
    expect(readClock("9:15 a. m.")).toEqual([9, 15]);
    expect(readClock("12:05 p. m.")).toEqual([12, 5]);
    expect(readClock("1:00 p. m.")).toEqual([13, 0]);
    expect(readClock("12:30 a. m.")).toEqual([0, 30]);
    expect(readClock("14:30")).toEqual([14, 30]);
    expect(readClock("Mediodía")).toBeNull();
  });

  it("places a line of the program at its instant", () => {
    expect(agendaInstant("2027-06-27", "9:15 a. m.", TZ)).toBe("2027-06-27T14:15:00.000Z");
    expect(agendaInstant("2027-06-28", "1:50 p. m.", TZ)).toBe("2027-06-28T18:50:00.000Z");
    expect(agendaInstant(undefined, "9:15 a. m.", TZ)).toBeNull();
  });

  it("ends a day of the program when its own header says, whatever the event's hours", () => {
    expect(dayEnd("9:00 a. m. a 2:00 p. m.", "2027-06-27", TZ)).toBe("2027-06-27T19:00:00.000Z");
    expect(dayEnd("De 9:00 a 14:30", "2027-06-28", TZ)).toBe("2027-06-28T19:30:00.000Z");
    expect(dayEnd("Desde las 9:00 a. m.", "2027-06-27", TZ)).toBeNull();
    expect(dayEnd("", "2027-06-27", TZ)).toBeNull();
  });
});

describe("the template", () => {
  it("has its panel: the card the program's line tells, and its four panelists", () => {
    const panel = panelOf(IMPARABLES_BLOCKS);
    expect(panel?.card.title).toBe("El día que decidí cambiar");
    expect(panel?.people.items).toHaveLength(4);
  });

  it("is made of blocks the editor and the API accept as they are", () => {
    for (const block of IMPARABLES_BLOCKS) expect(landingBlockSchema.safeParse(block).success).toBe(true);
    expect(parseLandingBlocks(JSON.parse(JSON.stringify(IMPARABLES_BLOCKS)))).toEqual(IMPARABLES_BLOCKS);
  });

  it("has the 8 speakers and one panel, every photo in the app", () => {
    const { speakers, panels } = castOf(IMPARABLES_BLOCKS);
    // In the team's order (2026-10-28).
    expect(speakers.map((s) => s.name)).toEqual([
      "Cristina Sierra",
      "Jimena Montalban",
      "Paula Chacón",
      "Oskar Garzón",
      "Juan Tenorio",
      "Karen Pinzón",
      "Fabi Pinillo Martínez",
      "Alejandro Salinas",
    ]);
    expect(speakers.every((s) => s.photoUrl)).toBe(true);
    expect(panels).toBe(1);
    const photos = JSON.stringify(IMPARABLES_BLOCKS).match(/\/imparables\/[a-z]+\.jpg/g) ?? [];
    expect(photos.length).toBeGreaterThan(8);
    for (const photo of new Set(photos)) expect(existsSync(path.join(process.cwd(), "public", photo))).toBe(true);
  });

  it("makes no panelist up: Maria Carolina, and three still to be announced with the story each brings", () => {
    const i = IMPARABLES_BLOCKS.findIndex((b, j) => isPanelCard(b, IMPARABLES_BLOCKS[j + 1]));
    const panelists = IMPARABLES_BLOCKS[i + 1];
    if (panelists?.type !== "people") throw new Error("no panelists");
    expect(panelists.items.map((p) => [p.name, p.handle, p.photoUrl])).toEqual([
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["Maria Carolina Sebastia Sandoval", "@maris_nails_oficial", "/imparables/maris.jpg"],
    ]);
    expect(panelists.items.map((p) => p.tag)).toEqual(IMPARABLES_PANELISTS.map((p) => p.story));
    // She is on the panel, not among the speakers.
    expect(castOf(IMPARABLES_BLOCKS).speakers.some((s) => s.handle === "@maris_nails_oficial")).toBe(false);
  });

  it("gives each card a line about her in the team's words, not her talk's title (the program says it)", () => {
    for (const s of IMPARABLES_SPEAKERS) {
      expect(s.tag.toLowerCase()).not.toContain(s.talk.toLowerCase());
      // From one line to a short paragraph (the team's bios, 2026-10-28).
      expect(s.tag.length).toBeGreaterThanOrEqual(75);
      expect(s.tag.length).toBeLessThanOrEqual(260);
    }
  });

  it("keeps the cover's tagline (its headline off the page for now) and «Nadie nace imparable» under the button", () => {
    expect(IMPARABLES_FIELDS.subtitle).toBe(
      "<p>Mentalidad · Dinero · Marketing</p><p>Deja de pensar en pequeño</p><p>Inspírate en quienes empezaron desde abajo, con tus mismos miedos, y hoy tienen el negocio y la vida que sueñas. <strong>Aprende cómo lo hicieron y replica sus estrategias para ganar</strong>.</p>"
    );
    expect(IMPARABLES_FIELDS.closingText).toBe("Nadie nace imparable. Se hace.");
    expect(IMPARABLES_FIELDS.registerButtonLabel).toBe("Reservar mi cupo");
    // Who is in the group photo, for those who can't see it.
    expect(coverOf(IMPARABLES_BLOCKS).cover?.caption).toBe("Jimena Montalban, Paula Chacón, Cristina Sierra, Alejandro Salinas, Fabi Pinillo Martínez, Juan Tenorio, Oskar Garzón, Maria Carolina Sebastia Sandoval y Heidy Aristizábal");
  });

  it("names no platform: Zoom is nowhere on the page", () => {
    const page = JSON.stringify([IMPARABLES_FIELDS, IMPARABLES_BLOCKS.filter((b) => !b.hidden)]);
    expect(page).not.toMatch(/zoom/i);
  });

  it("puts each speaker's talk under her name in the program, with its subtitle if it has one", () => {
    const agenda = IMPARABLES_BLOCKS.find((b) => b.type === "agenda");
    if (agenda?.type !== "agenda") throw new Error("no agenda");
    for (const s of IMPARABLES_SPEAKERS) {
      expect(agenda.rows.filter((r) => r.instructor === s.name).map((r) => [r.topic, r.text])).toEqual([[s.talk, s.subtitle ?? ""]]);
    }
  });

  it("keeps the 3 results and the 4 doubts, all hidden for now, each person on them a speaker, a panelist (or the panel)", () => {
    const slides = IMPARABLES_BLOCKS.filter((b) => b.type === "slides");
    expect(slides.map((b) => (b.type === "slides" ? [b.style, b.items.length, b.hidden === true] : null))).toEqual([
      ["results", 3, true],
      ["doubts", 3, true],
      ["doubts", 1, true],
    ]);
    const speakers = new Set([...IMPARABLES_SPEAKERS.map((s) => s.name), ...IMPARABLES_PANELISTS.map((p) => p.name).filter(Boolean)]);
    for (const block of slides) {
      if (block.type !== "slides") continue;
      for (const name of block.items.flatMap((it) => namesIn(it.who))) expect(speakers.has(name) || /panel/i.test(name)).toBe(true);
    }
  });

  const agendaOf = (blocks: LandingBlock[]) => {
    const agenda = blocks.find((b): b is AgendaLandingBlock => b.type === "agenda");
    if (!agenda) throw new Error("no agenda");
    const afternoon = agenda.rows.findIndex((r, i) => i > 0 && r.kind === "day");
    return { rows: agenda.rows, morning: agenda.rows.slice(1, afternoon), afternoon: agenda.rows.slice(afternoon + 1) };
  };

  it("tells its one day in two parts (2026-10-29): the morning's stories, from 8:00, the panel among them — no star talk", () => {
    const { rows, morning } = agendaOf(IMPARABLES_BLOCKS);
    // Each part says only when it starts: no title (the team, 2026-10-29).
    expect(rows.filter((r) => r.kind === "day").map((r) => [r.chip, r.topic])).toEqual([
      ["Mañana · 8:00 a. m.", ""],
      ["Tarde · 1:45 p. m.", ""],
    ]);
    // No subtitle under each part's title (the team, 2026-10-29).
    expect(rows.filter((r) => r.kind === "day").map((r) => r.takeaway)).toEqual(["", ""]);
    expect(morning.map((r) => [r.chip, r.instructor || r.topic])).toEqual([
      ["8:00 a. m.", "Bienvenida"],
      ["8:15 a. m.", "Jimena Montalban"],
      ["9:20 a. m.", "Maris"],
      ["10:20 a. m.", "Pausa activa"],
      ["10:35 a. m.", "Paula Chacón"],
      ["11:40 a. m.", "Cristina Sierra"],
      ["12:40 p. m.", "1 hora de almuerzo"],
    ]);
    expect(morning.filter((r) => r.label)).toEqual([]);
    expect(rows.filter((r) => r.star || /charla estrella/i.test(r.label))).toEqual([]);
    // The panel's line names Maris its own way: «Maris @maris_nails_oficial · desde Chile».
    expect(morning.find((r) => r.topic === "Panel «El día que decidí cambiar»")).toMatchObject({ instructor: "Maris", handles: "@maris_nails_oficial", text: "desde Chile", photoUrl: "/imparables/maris.jpg" });
  });

  it("makes the afternoon its five talks from 1:45, with no tag on them (2026-10-29), and the closing last", () => {
    const { afternoon } = agendaOf(IMPARABLES_BLOCKS);
    expect(afternoon.map((r) => [r.chip, r.instructor || r.topic])).toEqual([
      ["1:45 p. m.", "Alejandro Salinas"],
      ["2:50 p. m.", "Karen Pinzón"],
      ["3:50 p. m.", "Pausa activa"],
      ["4:05 p. m.", "Fabi Pinillo Martínez"],
      ["5:10 p. m.", "Juan Tenorio"],
      ["6:15 p. m.", "Oskar Garzón"],
      ["6:45 p. m.", "Cierre y sorteo"],
    ]);
    expect(afternoon.filter((r) => r.label)).toEqual([]);
    // Oskar's talk as the team approved it (2026-10-29).
    expect(afternoon.find((r) => r.instructor === "Oskar Garzón")).toMatchObject({
      topic: "Atrévete y piensa en grande",
      text: "Redes, actitud y orgullo por tu oficio: lo que necesitas para dejar de pensar en pequeño.",
    });
  });

  it("puts the results right after the program", () => {
    const agenda = IMPARABLES_BLOCKS.findIndex((b) => b.type === "agenda");
    expect(IMPARABLES_BLOCKS[agenda + 1]).toMatchObject({ type: "heading", eyebrow: "Resultados" });
    expect(IMPARABLES_BLOCKS[agenda + 2]).toMatchObject({ type: "slides", style: "results" });
  });

  it("says its guarantee the same way everywhere, and the refund answer in short lines", () => {
    const guarantee = "Garantía de 30 minutos: si en la primera media hora sientes que no es para ti, te devolvemos el 100%.";
    expect(IMPARABLES_FIELDS.ctaNote).toBe(guarantee);
    const doubts = IMPARABLES_BLOCKS.flatMap((b) => (b.type === "slides" && b.style === "doubts" ? b.items : []));
    expect(doubts.filter((it) => /30 minutos|media hora/.test(it.note)).map((it) => it.note)).toEqual([guarantee]);
    const faq = IMPARABLES_BLOCKS.find((b) => b.type === "faq");
    if (faq?.type !== "faq") throw new Error("no faq");
    const refund = faq.items.find((it) => it.question === "¿Puedo pedir reembolso?")!.answer;
    expect(refund).toContain(guarantee);
    for (const line of refund.split("\n")) expect(line.length).toBeLessThan(200);
    // Nothing promised in the old policy went missing.
    for (const part of ["5 días hábiles", "25 de junio", "repetición por 30 días", "nueva fecha", "WhatsApp", "máximo 30 días", "no hacemos devoluciones"]) expect(refund).toContain(part);
  });

  it("speaks plain Spanish: no «speakers» nor «Nail artist» on the page", () => {
    const shown = JSON.stringify(IMPARABLES_BLOCKS.filter((b) => !b.hidden));
    expect(shown).not.toMatch(/\bspeakers?\b|nail artist/i);
  });

  it("says nothing on the page about artificial intelligence or the next edition, nor the days' old titles", () => {
    const shown = JSON.stringify(IMPARABLES_BLOCKS.filter((b) => !b.hidden));
    expect(shown).not.toMatch(/inteligencia artificial|\bIA\b/i);
    expect(shown).not.toMatch(/próxima edición/i);
    for (const old of ["De la mesa a empresaria", "Sobresalir y pasar a la acción", "Hazte ver y pasa a la acción", "Así lo lograron", "Repaso", "Cierre del día"]) expect(shown).not.toContain(old);
  });

  it("says one day everywhere (2026-10-29): no 28th, no Monday, no two days — hidden texts too", () => {
    const all = JSON.stringify([IMPARABLES_FIELDS, IMPARABLES_BLOCKS]);
    expect(all).not.toMatch(/\b28\b|lunes|dos días|2 días/i);
    const faq = IMPARABLES_BLOCKS.find((b) => b.type === "faq");
    if (faq?.type !== "faq") throw new Error("no faq");
    expect(faq.items.map((it) => it.question).slice(0, 3)).toEqual(["¿Cómo me conecto?", "¿Y si no puedo verlo en vivo?", "¿Cuál es el horario?"]);
    expect(faq.items[1]!.answer).toMatch(/grabaciones de todas las charlas.*30 días en nailfest\.lat, con tu cuenta/);
  });

  it("brings four things with the ticket (2026-10-29: no «hoja de ruta» nor «descuentos»)", () => {
    const points = IMPARABLES_BLOCKS.find((b) => b.type === "points");
    if (points?.type !== "points") throw new Error("no points");
    expect(points.items.map((it) => it.title)).toEqual(["Un día completo en vivo", "Repetición por 30 días", "Guías para descargar", "Certificado digital"]);
    // No line under «Agenda».
    expect(IMPARABLES_BLOCKS.find((b) => b.type === "heading" && b.eyebrow === "Agenda")).toMatchObject({ title: "", intro: "" });
  });

  it("fits the program in its one day, from 8:00 a. m. to 7:00 p. m.", () => {
    const agenda = IMPARABLES_BLOCKS.find((b) => b.type === "agenda");
    if (agenda?.type !== "agenda") throw new Error("no agenda");
    const times = agenda.rows.filter((r) => r.kind === "session").map((r) => readClock(r.chip)!);
    for (const [h, m] of times) expect(h * 60 + m >= 8 * 60 && h * 60 + m < 19 * 60).toBe(true);
    // In order, each after the one before.
    for (let i = 1; i < times.length; i++) expect(times[i]![0] * 60 + times[i]![1]).toBeGreaterThan(times[i - 1]![0] * 60 + times[i - 1]![1]);
    expect(agenda.rows.filter((r) => r.kind === "day")).toHaveLength(2);
  });

  it("has three stages in order — Creyente, Decidida, the full price — each closing on its date or at its cap (2026-10-29)", () => {
    expect(IMPARABLES_STAGES.map((s) => [s.slug, s.name, s.price, s.cap])).toEqual([
      ["creyente", "Etapa Creyente", 90_000, 200],
      ["decidida", "Etapa Decidida", 120_000, 300],
      ["full", "Precio full", 150_000, null],
    ]);
    expect(IMPARABLES_STAGES.map((s) => s.closesAt)).toEqual(["2027-04-18T23:59:00-05:00", "2027-05-30T23:59:00-05:00", "2027-06-27T08:00:00-05:00"]);
    expect(IMPARABLES_STAGES.map((s) => s.note)).toEqual(["cierre de Nail Fest Cali", null, null]);
  });

  it("asks «¿Por qué sube el precio?» right after «¿Cómo pago?», its stages read from the ticket types", () => {
    const faq = IMPARABLES_BLOCKS.find((b) => b.type === "faq");
    if (faq?.type !== "faq") throw new Error("no faq");
    const questions = faq.items.map((it) => it.question);
    expect(questions[questions.indexOf("¿Cómo pago?") + 1]).toBe("¿Por qué sube el precio?");
    expect(faq.items.find((it) => it.question === "¿Por qué sube el precio?")!.answer).toBe(
      "Porque premiamos a las que deciden primero. {{etapas}} El precio nunca baja."
    );
  });
});

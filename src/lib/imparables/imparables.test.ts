import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { landingBlockSchema } from "@/lib/landingBlocks/schema";
import { emptyAgendaRow, parseLandingBlocks, type AgendaLandingBlock, type LandingBlock } from "@/lib/landingBlocks/types";
import { castLine, castOf, coverOf, isPanelCard, namesIn, panelOf, routeOf, talksOf } from "./blocks";
import { agendaInstant, coverName, dayEnd, eventWhen, readClock } from "./schedule";
import { pesos, salesState, saving, untilDay, type StageTicketType } from "./stages";
import { IMPARABLES_BLOCKS, IMPARABLES_GROUP_PHOTO, IMPARABLES_PANELISTS, IMPARABLES_SPEAKERS, IMPARABLES_STAGES } from "./template";

const TZ = "America/Bogota";
const at = (iso: string) => new Date(iso);
const STARTS = at("2027-06-27T09:00:00-05:00");

// The template's stages; `firstOpensAt` gives Etapa 1 a start date (the template has none).
const stages = (remaining = [3000, 3000, 3000, 3000], firstOpensAt: string | null = null): StageTicketType[] =>
  IMPARABLES_STAGES.map((s, i) => {
    const opensAt = i === 0 ? firstOpensAt : s.opensAt;
    return {
      id: `t${i}`,
      name: s.name,
      price: s.price,
      status: "ON_SALE",
      hideUntil: opensAt ? at(opensAt) : null,
      hideAfter: at(s.closesAt),
      remaining: remaining[i]!,
      order: i,
    };
  });

describe("salesState", () => {
  it("sells Etapa 1 from the moment the event is out: no waiting list", () => {
    const state = salesState(stages(), at("2026-10-26T10:00:00-05:00"), STARTS);
    expect(state.mode).toBe("sale");
    expect(state.current?.name).toBe("Etapa 1");
    expect(state.next?.name).toBe("Etapa 2");
    expect(state.countdown).toEqual({ to: at("2027-04-01T00:00:00-05:00"), label: "Este precio termina en" });
  });

  it("takes names for a waiting list when the first stage starts later, counting down to it", () => {
    const state = salesState(stages(undefined, "2027-02-27T00:00:00-05:00"), at("2027-01-15T10:00:00-05:00"), STARTS);
    expect(state.mode).toBe("waitlist");
    expect(state.current).toBeNull();
    expect(state.next?.name).toBe("Etapa 1");
    expect(state.countdown).toEqual({ to: at("2027-02-27T00:00:00-05:00"), label: "La venta abre en" });
  });

  it("sells today's stage and counts down to when its price ends", () => {
    const state = salesState(stages(), at("2027-03-01T10:00:00-05:00"), STARTS);
    expect(state.mode).toBe("sale");
    expect(state.current?.name).toBe("Etapa 1");
    expect(state.next?.name).toBe("Etapa 2");
    expect(state.countdown).toEqual({ to: at("2027-04-01T00:00:00-05:00"), label: "Este precio termina en" });
    expect(state.stages.map((s) => s.state)).toEqual(["current", "future", "future", "future"]);
  });

  it("in Etapa 3, counts down to the regular price", () => {
    const state = salesState(stages(), at("2027-06-22T10:00:00-05:00"), STARTS);
    expect(state.current?.name).toBe("Etapa 3");
    expect(state.next?.name).toBe("Precio normal");
    expect(state.countdown).toEqual({ to: at("2027-06-27T00:00:00-05:00"), label: "Este precio termina en" });
    expect(state.stages.map((s) => s.state)).toEqual(["past", "past", "current", "future"]);
  });

  it("sells the regular price on the congress's days, counting down to it", () => {
    const state = salesState(stages(), at("2027-06-27T07:00:00-05:00"), STARTS);
    expect(state.current?.name).toBe("Precio normal");
    expect(state.next).toBeNull();
    expect(state.countdown).toEqual({ to: STARTS, label: "El congreso empieza en" });
    expect(state.stages.map((s) => s.state)).toEqual(["past", "past", "past", "current"]);
  });

  it("closes when the congress ends", () => {
    const state = salesState(stages(), at("2027-06-28T15:00:00-05:00"), STARTS);
    expect(state.mode).toBe("closed");
    expect(state.countdown).toBeNull();
  });

  it("goes back to the waiting list when a stage sells out before the next one opens", () => {
    const state = salesState(stages([0, 3000, 3000, 3000], "2027-02-27T00:00:00-05:00"), at("2027-03-15T10:00:00-05:00"), STARTS);
    expect(state.mode).toBe("waitlist");
    expect(state.stages[0]!.state).toBe("soldout");
    expect(state.next?.name).toBe("Etapa 2");
  });

  it("ignores ticket types that aren't on sale", () => {
    const types = stages().map((t, i) => (i === 0 ? { ...t, status: "HIDDEN" } : t));
    const state = salesState(types, at("2027-03-01T10:00:00-05:00"), STARTS);
    expect(state.stages.map((s) => s.name)).toEqual(["Etapa 2", "Etapa 3", "Precio normal"]);
    expect(state.mode).toBe("waitlist");
  });

  it("tells each stage's saving against the regular price", () => {
    const state = salesState(stages(), at("2026-10-26T10:00:00-05:00"), STARTS);
    expect(state.normal?.name).toBe("Precio normal");
    expect(state.stages.map((s) => saving(s, state.normal))).toEqual([70_000, 50_000, 30_000, 0]);
    // With no regular price there's nothing to save against.
    const without = salesState(stages().slice(0, 3), at("2026-10-26T10:00:00-05:00"), STARTS);
    expect(without.normal).toBeNull();
    expect(saving(without.current!, without.normal)).toBe(0);
  });
});

describe("how prices and dates read", () => {
  it("writes pesos with dots", () => {
    expect(pesos(79_900)).toBe("$79.900");
    expect(pesos(119_900)).toBe("$119.900");
    expect(pesos(1_000_000)).toBe("$1.000.000");
    expect(pesos(900)).toBe("$900");
  });

  it("says the last day a stage's price holds, the day before it closes", () => {
    expect(untilDay(at("2027-04-01T00:00:00-05:00"), TZ)).toBe("31 de marzo");
    expect(untilDay(at("2027-06-27T00:00:00-05:00"), TZ)).toBe("26 de junio");
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
      hours: "9:00 a. m. a 2:00 p. m.",
      short: "27 y 28 de junio",
      compact: "27 & 28 Junio 2027",
      days: ["2027-06-27", "2027-06-28"],
      span: { opensAt: "2027-06-27T14:00:00.000Z", closesAt: "2027-06-27T19:00:00.000Z" },
      ends: ["2027-06-27T19:00:00.000Z", "2027-06-28T19:00:00.000Z"],
    });
  });

  it("writes the cover's dates as short as they get", () => {
    const one = (startsAt: string, endsAt: string | null) => eventWhen({ startsAt: at(startsAt), endsAt: endsAt ? at(endsAt) : null }, TZ).compact;
    expect(one("2027-06-27T09:00:00-05:00", null)).toBe("27 Junio 2027");
    expect(one("2027-06-27T09:00:00-05:00", "2027-06-29T14:00:00-05:00")).toBe("27 – 29 Junio 2027");
    expect(one("2027-06-30T09:00:00-05:00", "2027-07-01T14:00:00-05:00")).toBe("30 Junio & 1 Julio 2027");
    expect(one("2026-12-31T09:00:00-05:00", "2027-01-01T14:00:00-05:00")).toBe("31 Diciembre 2026 & 1 Enero 2027");
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

  it("names who is under the group photo", () => {
    expect(castLine(IMPARABLES_BLOCKS)).toEqual({
      names: "Jimena Montalban, Paula Chacón, Cristina Sierra, Alejandro Salinas, Karen, Fabi Pinillo Martínez, Juan Tenorio y Oskar Garzón",
      also: "con Heidy Aristizábal y el panel «El día que decidí cambiar»",
    });
  });

  it("finds each speaker's talk in the program, for her card", () => {
    const talks = talksOf(IMPARABLES_BLOCKS);
    for (const s of IMPARABLES_SPEAKERS) expect(talks[s.name.toLowerCase()]).toBe(s.talk);
    expect(Object.keys(talks)).toHaveLength(IMPARABLES_SPEAKERS.length);
  });

  it("makes a day's route out of its talks' steps", () => {
    const row = (label: string) => ({ ...emptyAgendaRow("session"), label });
    expect(routeOf([row("Paso 1 · Tus números"), row(""), row("Paso 2 · Tu esencia"), row("Paso 3: Atraer")])).toEqual(["Tus números", "tu esencia", "atraer"]);
    expect(routeOf([row("Charla estrella"), row("Paso 1 · Tus números")])).toEqual([]);
    expect(routeOf([])).toEqual([]);
  });

  it("reads the names on a card as typed", () => {
    expect(namesIn("Fabi, Alejandro Salinas y Oskar")).toEqual(["Fabi", "Alejandro Salinas", "Oskar"]);
    expect(namesIn("Juan Tenorio, Pau y el panel")).toEqual(["Juan Tenorio", "Pau", "el panel"]);
    expect(namesIn("  ")).toEqual([]);
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
    expect(speakers.map((s) => s.name)).toEqual([
      "Jimena Montalban",
      "Paula Chacón",
      "Cristina Sierra",
      "Alejandro Salinas",
      "Karen",
      "Fabi Pinillo Martínez",
      "Juan Tenorio",
      "Oskar Garzón",
    ]);
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

  it("puts each speaker's talk under her name in the program, with its subtitle if it has one", () => {
    const agenda = IMPARABLES_BLOCKS.find((b) => b.type === "agenda");
    if (agenda?.type !== "agenda") throw new Error("no agenda");
    for (const s of IMPARABLES_SPEAKERS) {
      expect(agenda.rows.filter((r) => r.instructor === s.name).map((r) => [r.topic, r.text])).toEqual([[s.talk, s.subtitle ?? ""]]);
    }
  });

  it("has the 3 results and the 4 doubts, each person on them a speaker, a panelist (or the panel)", () => {
    const slides = IMPARABLES_BLOCKS.filter((b) => b.type === "slides");
    expect(slides.map((b) => (b.type === "slides" ? [b.style, b.items.length] : null))).toEqual([
      ["results", 3],
      ["doubts", 4],
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
    const monday = agenda.rows.findIndex((r, i) => i > 0 && r.kind === "day");
    return { rows: agenda.rows, sunday: agenda.rows.slice(1, monday), monday: agenda.rows.slice(monday + 1) };
  };

  it("gives each day its subtitle; Sunday tells the stories, the panel its star talk, with no box", () => {
    const { rows, sunday } = agendaOf(IMPARABLES_BLOCKS);
    expect(rows.filter((r) => r.kind === "day").map((r) => [r.chip, r.text])).toEqual([
      ["Domingo 27 de junio", "9:00 a. m. a 1:45 p. m."],
      ["Lunes 28 de junio", "9:00 a. m. a 2:00 p. m."],
    ]);
    expect(rows.filter((r) => r.kind === "day").every((r) => r.takeaway.length > 0)).toBe(true);
    expect(sunday.filter((r) => r.label).map((r) => [r.topic, r.label])).toEqual([["Panel «El día que decidí cambiar»", "Charla estrella"]]);
    expect(rows.filter((r) => r.star)).toEqual([]);
  });

  it("makes Monday a plan in five steps, the route they make under the day's subtitle", () => {
    const { monday } = agendaOf(IMPARABLES_BLOCKS);
    expect(monday.filter((r) => r.label).map((r) => [r.label, r.instructor])).toEqual([
      ["Paso 1 · Tus números", "Alejandro Salinas"],
      ["Paso 2 · Tu esencia", "Karen"],
      ["Paso 3 · Atraer", "Fabi Pinillo Martínez"],
      ["Paso 4 · Retener", "Juan Tenorio"],
      ["Paso 5 · Tu ruta", "Oskar Garzón"],
    ]);
    expect(routeOf(monday).join(" → ")).toBe("Tus números → tu esencia → atraer → retener → tu ruta");
  });

  it("puts the results right after the program", () => {
    const agenda = IMPARABLES_BLOCKS.findIndex((b) => b.type === "agenda");
    expect(IMPARABLES_BLOCKS[agenda + 1]).toMatchObject({ type: "heading", eyebrow: "Resultados" });
    expect(IMPARABLES_BLOCKS[agenda + 2]).toMatchObject({ type: "slides", style: "results" });
  });

  it("says nothing on the page about artificial intelligence, nor the days' old titles", () => {
    const shown = JSON.stringify(IMPARABLES_BLOCKS.filter((b) => !b.hidden));
    expect(shown).not.toMatch(/inteligencia artificial|\bIA\b/i);
    for (const old of ["De la mesa a empresaria", "Sobresalir y pasar a la acción", "Hazte ver y pasa a la acción"]) expect(shown).not.toContain(old);
  });

  it("fits each day of the program between 9:00 a. m. and 2:00 p. m.", () => {
    const agenda = IMPARABLES_BLOCKS.find((b) => b.type === "agenda");
    if (agenda?.type !== "agenda") throw new Error("no agenda");
    const times = agenda.rows.filter((r) => r.kind === "session").map((r) => readClock(r.chip)!);
    for (const [h, m] of times) expect(h * 60 + m >= 9 * 60 && h * 60 + m < 14 * 60).toBe(true);
    expect(agenda.rows.filter((r) => r.kind === "day")).toHaveLength(2);
  });

  it("opens Etapa 1 with the event and chains the stages without gaps, the regular price last", () => {
    expect(IMPARABLES_STAGES[0]!.opensAt).toBeNull();
    for (let i = 1; i < IMPARABLES_STAGES.length; i++) expect(IMPARABLES_STAGES[i]!.opensAt).toBe(IMPARABLES_STAGES[i - 1]!.closesAt);
    expect(IMPARABLES_STAGES.map((s) => s.name)).toEqual(["Etapa 1", "Etapa 2", "Etapa 3", "Precio normal"]);
    expect(IMPARABLES_STAGES.map((s) => s.price)).toEqual([80_000, 100_000, 120_000, 150_000]);
  });
});

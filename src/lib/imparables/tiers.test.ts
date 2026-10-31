import { describe, expect, it } from "vitest";
import { salesState, type StageTicketType } from "./stages";
import { GUARANTEE, TIERS, isTieredVersion, tierAvailable, tierBySlug, tierCounter, tierPrice, tiersInOrder, upgradeDifference, withTierBlocks } from "./tiers";
import type { LandingBlock } from "@/lib/landingBlocks/types";

// The ticket levels (lib/imparables/tiers.ts, 2026-10-31): only on the versions
// that sell them; Imparable at the stage's price, Círculo and Élite at their own.

const STARTS = new Date("2027-06-27T08:00:00-05:00");
const stages = (paidCreyente = 0): StageTicketType[] => [
  { id: "t_cre", name: "Etapa Creyente", slug: "creyente", price: 90_000, status: "ON_SALE", hideUntil: null, hideAfter: new Date("2027-04-18T23:59:00-05:00"), cap: 200, paid: paidCreyente, note: "cierre de Nail Fest Cali", order: 1 },
  { id: "t_dec", name: "Etapa Decidida", slug: "decidida", price: 120_000, status: "ON_SALE", hideUntil: null, hideAfter: new Date("2027-05-30T23:59:00-05:00"), cap: 300, paid: 0, order: 2 },
  { id: "t_full", name: "Precio full", slug: "full", price: 150_000, status: "ON_SALE", hideUntil: null, hideAfter: STARTS, cap: null, paid: 0, order: 3 },
];
const tier = (slug: string) => tierBySlug(slug)!;

describe("the levels", () => {
  it("are only on the versions that sell them", () => {
    expect(isTieredVersion("sapate")).toBe(true);
    expect(isTieredVersion(null)).toBe(false);
    expect(isTieredVersion("otra")).toBe(false);
  });

  it("go Élite, Círculo, Imparable", () => {
    expect(tiersInOrder().map((t) => t.slug)).toEqual(["elite", "circulo", "imparable"]);
    expect(TIERS.find((t) => t.slug === "elite")?.cap).toBe(20);
    expect(TIERS.find((t) => t.slug === "circulo")?.cap).toBeNull();
  });
});

describe("each level's price in each stage", () => {
  const at = (date: string) => salesState(stages(), new Date(date), STARTS).current;
  it.each([
    ["Creyente", "2027-02-01T10:00:00-05:00", 90_000],
    ["Decidida", "2027-05-01T10:00:00-05:00", 120_000],
    ["Precio full", "2027-06-10T10:00:00-05:00", 150_000],
  ])("%s: Imparable at the stage's price, Círculo $190.000 and Élite $390.000", (_name, date, stagePrice) => {
    const stage = at(date);
    expect(tierPrice(tier("imparable"), stage)).toBe(stagePrice);
    expect(tierPrice(tier("circulo"), stage)).toBe(190_000);
    expect(tierPrice(tier("elite"), stage)).toBe(390_000);
  });

  it("Círculo and Élite keep their price even with no stage on sale", () => {
    expect(tierPrice(tier("imparable"), null)).toBeNull();
    expect(tierPrice(tier("circulo"), null)).toBe(190_000);
    expect(tierPrice(tier("elite"), null)).toBe(390_000);
  });
});

describe("Élite's 20 places", () => {
  it("has a place at 19 paid and none at 20", () => {
    expect(tierAvailable(tier("elite"), 19)).toBe(true);
    expect(tierAvailable(tier("elite"), 20)).toBe(false);
  });

  it("Círculo never runs out", () => {
    expect(tierAvailable(tier("circulo"), 5_000)).toBe(true);
  });
});

describe("moving up", () => {
  it("costs exactly the difference with what she paid", () => {
    expect(upgradeDifference(90_000, tier("circulo"))).toBe(100_000);
    expect(upgradeDifference(120_000, tier("circulo"))).toBe(70_000);
    expect(upgradeDifference(150_000, tier("circulo"))).toBe(40_000);
    // From Círculo — her stage plus the difference she paid: 190.000 in all.
    expect(upgradeDifference(90_000 + 100_000, tier("elite"))).toBe(200_000);
    expect(upgradeDifference(90_000, tier("elite"))).toBe(300_000);
  });

  it("never below zero", () => {
    expect(upgradeDifference(500_000, tier("circulo"))).toBe(0);
  });
});

describe("the stage's counter", () => {
  const counter = (left: number) => tierCounter(salesState(stages(200 - left), new Date("2027-02-01T10:00:00-05:00"), STARTS));

  it("is hidden with 61 places left of 200, and with exactly 30% (60)", () => {
    expect(counter(61)).toBeNull();
    expect(counter(60)).toBeNull();
  });

  it("shows with 59 left", () => {
    expect(counter(59)?.text).toBe("Etapa Creyente · 70\u00a0% vendida · quedan 59 cupos a $90.000");
  });

  it("says it as the team asked at 72%", () => {
    expect(counter(56)).toEqual({ text: "Etapa Creyente · 72\u00a0% vendida · quedan 56 cupos a $90.000", share: 0.72, left: 56 });
  });

  it("one place left", () => {
    expect(counter(1)?.text).toBe("Etapa Creyente · 99\u00a0% vendida · queda 1 cupo a $90.000");
  });

  it("nothing for a stage with no cap", () => {
    expect(tierCounter(salesState(stages(), new Date("2027-06-10T10:00:00-05:00"), STARTS))).toBeNull();
  });
});

describe("the questions on these versions", () => {
  const faq = (questions: string[]): LandingBlock =>
    ({ type: "faq", title: "Preguntas", items: questions.map((question) => ({ question, answer: "Antes" })) }) as unknown as LandingBlock;

  it("«¿Y si no me gusta?» goes right before the refund one, whose answer says the guarantee", () => {
    const [block] = withTierBlocks([faq(["¿Cuándo es?", "¿Puedo pedir reembolso?", "¿Hay certificado?"])]);
    const items = (block as unknown as { items: { question: string; answer: string }[] }).items;
    expect(items.map((i) => i.question)).toEqual(["¿Cuándo es?", GUARANTEE.question, "¿Puedo pedir reembolso?", "¿Hay certificado?"]);
    expect(items[1]!.answer).toBe(GUARANTEE.answer);
    expect(items[2]!.answer).toBe(GUARANTEE.refund);
    expect(items[3]!.answer).toBe("Antes");
  });

  it("the 30 minutes' guarantee becomes the Garantía Imparable in a card and in a doubt's note", () => {
    const blocks = withTierBlocks([
      { type: "card", eyebrow: "Garantía de 30 minutos", title: "Si no es para ti, te devolvemos tu dinero", html: "<p>Si en la primera media hora…</p>", icon: "shield", tone: "teal", imageUrl: "" },
      { type: "card", eyebrow: "Panel", title: "Otra", html: "<p>Nada que ver</p>", icon: "none", tone: "pink", imageUrl: "" },
      {
        type: "slides",
        style: "doubts",
        items: [
          { tag: "", title: "Ya hice cursos y no me sirvieron.", text: "…", noteLabel: "", note: "Garantía de 30 minutos: si en la primera media hora…", who: "", icon: "shield" },
          { tag: "", title: "No tengo tiempo.", text: "…", noteLabel: "", note: "La repetición por 30 días viene con tu boleta.", who: "", icon: "clock" },
        ],
      },
    ] as LandingBlock[]) as unknown as [{ eyebrow: string; html: string; title: string }, { eyebrow: string }, { items: { note: string }[] }];
    expect(blocks[0]).toMatchObject({ eyebrow: "Garantía Imparable", title: "Si no es para ti, te devolvemos tu dinero", html: "<p>Escucha la primera charla y, si no es para ti, te devolvemos el 100\u00a0% ese mismo día.</p>" });
    expect(blocks[1].eyebrow).toBe("Panel");
    expect(blocks[2].items.map((i) => i.note)).toEqual([`${GUARANTEE.title} ${GUARANTEE.line}`, "La repetición por 30 días viene con tu boleta."]);
  });

  it("with no refund question, it goes last — once, in the first list", () => {
    const blocks = withTierBlocks([faq(["¿Cuándo es?"]), faq(["¿Otra?"])]);
    const questions = blocks.map((b) => (b as unknown as { items: { question: string }[] }).items.map((i) => i.question));
    expect(questions).toEqual([["¿Cuándo es?", GUARANTEE.question], ["¿Otra?"]]);
  });
});

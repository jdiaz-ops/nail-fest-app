import { describe, expect, it } from "vitest";
import { coverDeal, riseCountdown, salesState, showsCounter, type StageTicketType } from "./stages";

// Under the cover's button, as the team's boceto (2026-10-31): the stage's
// places as the offer until 30% of them are paid, then the counter; the
// countdown to the price going up only in the stage's last three weeks.

const STARTS = new Date("2027-06-27T08:00:00-05:00");
const TZ = "America/Bogota";
const nb = (t: string) => t.replace(/ /g, " ");
const stages = (paidCreyente = 0): StageTicketType[] => [
  { id: "t_cre", name: "Etapa Creyente", slug: "creyente", price: 90_000, status: "ON_SALE", hideUntil: null, hideAfter: new Date("2027-04-18T23:59:00-05:00"), cap: 200, paid: paidCreyente, note: "cierre de Nail Fest Cali", order: 1 },
  { id: "t_dec", name: "Etapa Decidida", slug: "decidida", price: 120_000, status: "ON_SALE", hideUntil: null, hideAfter: new Date("2027-05-30T23:59:00-05:00"), cap: 300, paid: 0, order: 2 },
  { id: "t_full", name: "Precio full", slug: "full", price: 150_000, status: "ON_SALE", hideUntil: null, hideAfter: STARTS, cap: null, paid: 0, order: 3 },
];
const sales = (paid: number, date = "2027-02-01T10:00:00-05:00", types = stages(paid)) => salesState(types, new Date(date), STARTS);

describe("the counter", () => {
  it("shows once 30% of the places are paid: not at 59 of 200, yes at 60", () => {
    expect(showsCounter(sales(0))).toBe(false);
    expect(showsCounter(sales(59))).toBe(false);
    expect(showsCounter(sales(60))).toBe(true);
  });

  it("never for a stage with no cap", () => {
    expect(showsCounter(sales(0, "2027-06-10T10:00:00-05:00"))).toBe(false);
  });
});

describe("under the cover's button", () => {
  it("before the counter: the places as the offer, then the date with its note, the places and the next price", () => {
    expect(coverDeal(sales(0), TZ)).toEqual({
      kind: "first",
      stage: "Etapa Creyente",
      offer: `Las primeras ${nb("200 entran")} a $90.000`,
      terms: `Hasta el ${nb("18 de abril")} (cierre de Nail Fest Cali) o hasta completar las 200 · luego $120.000`,
    });
  });

  it("with no date of its own, only its places", () => {
    const noDate = stages().map((t) => (t.id === "t_cre" ? { ...t, hideAfter: null } : t));
    expect(coverDeal(sales(0, undefined, noDate), TZ)?.terms).toBe("Hasta completar las 200 · luego $120.000");
  });

  it("the counter: what's left of the first 200, then the stage, its date and the next price", () => {
    expect(coverDeal(sales(73), TZ)).toEqual({
      kind: "counter",
      title: "Quedan 127 de las primeras 200 a $90.000",
      terms: `Etapa Creyente · hasta el ${nb("18 de abril")} · luego $120.000`,
    });
    expect(coverDeal(sales(199), TZ)).toMatchObject({ title: "Queda 1 de las primeras 200 a $90.000" });
  });

  it("a stage with no cap keeps its line", () => {
    expect(coverDeal(sales(0, "2027-06-10T10:00:00-05:00"), TZ)).toEqual({ kind: "line", terms: `Precio full · $150.000 · hasta el ${nb("27 de junio")}` });
  });
});

describe("the countdown to the price going up", () => {
  it("only in the stage's last three weeks, to its close, with the next price", () => {
    expect(riseCountdown(sales(0, "2027-03-20T10:00:00-05:00"), new Date("2027-03-20T10:00:00-05:00"))).toBeNull();
    const now = new Date("2027-04-06T10:00:00-05:00");
    const rise = riseCountdown(sales(0, "2027-04-06T10:00:00-05:00"), now);
    expect(rise).toMatchObject({ to: new Date("2027-04-18T23:59:00-05:00"), price: 120_000 });
    expect(rise!.seconds).toBe(Math.floor((rise!.to.getTime() - now.getTime()) / 1000));
  });

  it("never for the last stage: no price after it", () => {
    expect(riseCountdown(sales(0, "2027-06-20T10:00:00-05:00"), new Date("2027-06-20T10:00:00-05:00"))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { GUARANTEE } from "./tiers";
import { TRANSFORMATION, isTransformationVersion, withTransformationBlocks } from "./transformacion";

// The page «vender la transformación» (lib/imparables/transformacion.ts,
// 2026-10-31): only on its versions, and only its blocks change.

const heading = (title: string, eyebrow = "", intro = ""): LandingBlock => ({ type: "heading", eyebrow, title, intro });
const PAGE = (): LandingBlock[] =>
  [
    { type: "image", url: "/grupo.webp", caption: "" },
    heading("¿Qué tienen en común todos los conferencistas de Manicuristas Imparables?"),
    { type: "text", html: "<p>Ninguno empezó arriba.</p>" },
    heading("Lo que vas a resolver en un solo día", "Resultados"),
    { type: "slides", style: "results", items: [{ tag: "Más clientas", title: "Llena tu agenda", text: "…", noteLabel: "", note: "", who: "", icon: "none" }] },
    heading(""),
    { type: "people", items: [{ name: "Cristina Sierra", handle: "", role: "", bio: "", photoUrl: "" }] },
    { type: "card", eyebrow: "Maestra de ceremonias", title: "Heidy Aristizábal", html: "<p>@hlacosedora</p>", icon: "none", tone: "pink", imageUrl: "" },
    heading("", "Agenda"),
    {
      type: "agenda",
      rows: [
        { kind: "day", chip: "Mañana · 8:00 a. m.", topic: "", instructor: "", brand: "", text: "", tone: "pink", takeaway: "", sponsored: false, star: false, label: "" },
        { kind: "session", chip: "8:15 a. m.", topic: "Lo que nadie te cuenta de crecer", instructor: "Jimena Montalban", brand: "", text: "", tone: "teal", takeaway: "", sponsored: false, star: false, label: "" },
        { kind: "day", chip: "Tarde · 1:45 p. m.", topic: "", instructor: "", brand: "", text: "", tone: "pink", takeaway: "", sponsored: false, star: false, label: "" },
        { kind: "session", chip: "1:45 p. m.", topic: "Ordena tu plata", instructor: "Alejandro Salinas", brand: "", text: "", tone: "teal", takeaway: "", sponsored: false, star: false, label: "" },
      ],
    },
    heading("Todo lo que trae tu boleta", "Qué incluye"),
    { type: "points", tone: "teal", items: [{ title: "Un día completo en vivo", text: "9 conferencistas y un panel." }, { title: "Certificado digital", text: "De asistencia, con tu nombre." }] },
    { type: "card", eyebrow: "Garantía de 30 minutos", title: "Si no es para ti, te devolvemos tu dinero", html: "<p>Si en la primera media hora…</p>", icon: "shield", tone: "teal", imageUrl: "" },
    heading("Lo que te estás preguntando", "Preguntas frecuentes"),
    {
      type: "faq",
      title: "",
      items: [
        { question: "¿Cómo me conecto?", answer: "Con tu enlace personal." },
        { question: "¿Puedo pedir reembolso?", answer: "Sí, en estos casos: • Garantía de 30 minutos…" },
      ],
    },
  ] as LandingBlock[];

describe("the versions that sell the transformation", () => {
  it("are the listed ones only", () => {
    expect(isTransformationVersion("2v")).toBe(true);
    expect(isTransformationVersion("2V")).toBe(true);
    expect(isTransformationVersion("sapate")).toBe(false);
    expect(isTransformationVersion(null)).toBe(false);
  });
});

describe("their blocks", () => {
  const out = withTransformationBlocks(PAGE());
  const types = out.map((b) => b.type);

  it("drop «Lo que vas a resolver» and the 30 minutes' card, and nothing else", () => {
    expect(types).toEqual(["image", "heading", "text", "heading", "people", "card", "heading", "agenda", "heading", "points", "heading", "faq"]);
    expect(out.some((b) => b.type === "slides")).toBe(false);
    expect(out.some((b) => b.type === "card" && /garant/i.test(b.eyebrow))).toBe(false);
  });

  it("give the speakers their title and their line", () => {
    const speakers = out[3];
    expect(speakers).toMatchObject({ type: "heading", title: TRANSFORMATION.speakers.title, intro: TRANSFORMATION.speakers.intro });
  });

  it("put the paragraph under each part of the program", () => {
    const agenda = out.find((b) => b.type === "agenda")!;
    expect(agenda.type === "agenda" && agenda.rows.map((r) => r.takeaway)).toEqual([TRANSFORMATION.agenda.morning, "", TRANSFORMATION.agenda.afternoon, ""]);
  });

  it("turn «Todo lo que trae tu boleta» into «Lo que te llevas», with its six results", () => {
    expect(out[8]).toMatchObject({ type: "heading", title: "Lo que te llevas", eyebrow: "Qué incluye" });
    const points = out[9];
    expect(points.type === "points" && points.items.map((i) => i.title)).toEqual([
      "Un día que te cambia la forma de ver tu negocio",
      "Vuelve a verlo cuando lo necesites",
      "Las herramientas de cada conferencista",
      "Tu diploma Imparable 2027",
      "Tu cuaderno «Mi Ruta Imparable»",
      "Garantía Imparable",
    ]);
  });

  it("put the questions that sell first, keep the logistics ones, and make the refund one say the guarantee", () => {
    const faq = out.find((b) => b.type === "faq")!;
    const items = faq.type === "faq" ? faq.items : [];
    expect(items.map((i) => i.question)).toEqual([...TRANSFORMATION.questions.map((q) => q.question), "¿Cómo me conecto?", "¿Puedo pedir reembolso?"]);
    expect(items[items.length - 1]!.answer).toBe(GUARANTEE.refund);
  });

  it("leave the main page alone: it never calls this", () => {
    expect(withTransformationBlocks([])).toEqual([]);
  });
});

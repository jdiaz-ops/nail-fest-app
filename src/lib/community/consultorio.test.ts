import { describe, expect, it } from "vitest";
import {
  answerSchema,
  answersLabel,
  contentProblem,
  earnsInsignia,
  memberSignupSchema,
  questionSchema,
  questionSlugBase,
  safeReturn,
  timeAgo,
} from "./consultorio";

describe("what can go up in the Consultorio", () => {
  it("no links, emails or phones — prices and handles are fine", () => {
    expect(contentProblem("Mira www.mitienda.com")).toMatch(/enlaces/);
    expect(contentProblem("https://bit.ly/x")).toMatch(/enlaces/);
    expect(contentProblem("escríbeme a ana@gmail.com")).toMatch(/enlaces/);
    expect(contentProblem("escríbeme al 300 123 4567")).toMatch(/teléfonos/);
    expect(contentProblem("+57 3001234567")).toMatch(/teléfonos/);
    expect(contentProblem("Cobro $1.500.000 por el curso y $35.000 por semipermanente")).toBeNull();
    expect(contentProblem("Sígueme en @ana.nails, uso el top coat de 15 ml")).toBeNull();
  });

  it("a question: its topic, a real question, optional details", () => {
    expect(questionSchema.parse({ topic: "productos", title: "  ¿Por qué se pone amarillo el top coat?  ", body: "  " })).toEqual({
      topic: "productos",
      title: "¿Por qué se pone amarillo el top coat?",
      body: null,
    });
    expect(questionSchema.safeParse({ topic: "productos", title: "¿Qué?" }).success).toBe(false);
    expect(questionSchema.safeParse({ topic: "otro", title: "¿Por qué se pone amarillo?" }).success).toBe(false);
    const withLink = questionSchema.safeParse({ topic: "negocio", title: "¿Cuánto cobrar por un retiro?", body: "Vean mi página www.ana.com" });
    expect(withLink.success).toBe(false);
    if (!withLink.success) expect(withLink.error.issues[0]?.message).toMatch(/enlaces/);
  });

  it("an answer: at least a couple of letters, no phone", () => {
    expect(answerSchema.safeParse({ body: " " }).success).toBe(false);
    expect(answerSchema.safeParse({ body: "Cura cada capa el tiempo completo." }).success).toBe(true);
    expect(answerSchema.safeParse({ body: "Llámame 3001234567" }).success).toBe(false);
  });

  it("an account: name and city to show, email lowercase, the rules accepted", () => {
    expect(memberSignupSchema.parse({ name: " Laura ", city: "Cúcuta", email: " Laura@Correo.COM ", password: "12345678", acceptTerms: true })).toMatchObject({
      name: "Laura",
      email: "laura@correo.com",
    });
    expect(memberSignupSchema.safeParse({ name: "Laura", city: "Cúcuta", email: "laura@correo.com", password: "12345678", acceptTerms: false }).success).toBe(false);
    expect(memberSignupSchema.safeParse({ name: "Laura 3001234567", city: "Cúcuta", email: "l@c.com", password: "12345678", acceptTerms: true }).success).toBe(false);
  });
});

describe("the insignia «Ayuda en el Consultorio»", () => {
  it("three answers that solved it, or ten «Me sirvió»", () => {
    expect(earnsInsignia({ best: 3, useful: 0 })).toBe(true);
    expect(earnsInsignia({ best: 0, useful: 10 })).toBe(true);
    expect(earnsInsignia({ best: 2, useful: 9 })).toBe(false);
  });
});

describe("addresses and times", () => {
  it("a question's address comes from its title", () => {
    expect(questionSlugBase("¿Cómo hago para que el top coat no se ponga amarillo?")).toBe("como-hago-para-que-el-top-coat-no-se-ponga-amarillo");
    expect(questionSlugBase("¿?")).toBe("pregunta");
    expect(questionSlugBase("a".repeat(100))).toHaveLength(70);
  });

  it("only comes back to the Consultorio or the account", () => {
    expect(safeReturn("/consultorio/como-hago")).toBe("/consultorio/como-hago");
    expect(safeReturn("/consultorio/preguntar?tema=salud")).toBe("/consultorio/preguntar?tema=salud");
    expect(safeReturn("/cuenta")).toBe("/cuenta");
    expect(safeReturn("https://otro.com")).toBe("/consultorio");
    expect(safeReturn("//otro.com/consultorio")).toBe("/consultorio");
    expect(safeReturn("/admin")).toBe("/consultorio");
  });

  it("says how long ago, then the date", () => {
    const now = new Date("2026-10-24T20:00:00Z");
    expect(timeAgo(new Date("2026-10-24T19:59:40Z"), now)).toBe("hace un momento");
    expect(timeAgo(new Date("2026-10-24T19:35:00Z"), now)).toBe("hace 25 min");
    expect(timeAgo(new Date("2026-10-24T17:00:00Z"), now)).toBe("hace 3 h");
    expect(timeAgo(new Date("2026-10-23T18:00:00Z"), now)).toBe("ayer");
    expect(timeAgo(new Date("2026-10-20T18:00:00Z"), now)).toBe("hace 4 días");
    expect(timeAgo(new Date("2026-10-02T18:00:00Z"), now)).toBe("2 oct");
    expect(answersLabel(0)).toBe("Sin respuestas");
    expect(answersLabel(1)).toBe("1 respuesta");
    expect(answersLabel(4)).toBe("4 respuestas");
  });
});

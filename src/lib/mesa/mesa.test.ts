import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { MESA_MODEL, MESA_SYSTEM, MesaAiError, problemOfError, proposePieces, proposeSubjects } from "./ai";
import { assignEditions, contentOf, editionDate, longDate, nextEdition, sectionsOf, shortDate, summaryOf } from "./sections";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const FIRST = day("2026-11-05");

describe("La Mesa's editions", () => {
  it("one to play with and one for the trade take turns; El termómetro is in all of them", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => sectionsOf(n).join(" "))).toEqual([
      "MITO TERMOMETRO TRUCO",
      "PALABRA TERMOMETRO PORQUE",
      "SABIAS TERMOMETRO TRUCO",
      "MITO TERMOMETRO PORQUE",
      "PALABRA TERMOMETRO TRUCO",
      "SABIAS TERMOMETRO PORQUE",
      "MITO TERMOMETRO TRUCO",
    ]);
  });

  it("every 14 days from the first one, a Thursday", () => {
    expect(longDate(editionDate(FIRST, 1))).toBe("jueves 5 de noviembre");
    expect(longDate(editionDate(FIRST, 2))).toBe("jueves 19 de noviembre");
    expect(shortDate(editionDate(FIRST, 4))).toBe("17 dic");
  });

  it("the next one is the first on or after today", () => {
    expect(nextEdition(FIRST, day("2026-10-25"))).toBe(1);
    expect(nextEdition(FIRST, day("2026-11-05"))).toBe(1);
    expect(nextEdition(FIRST, day("2026-11-06"))).toBe(2);
    expect(nextEdition(FIRST, day("2026-11-19"))).toBe(2);
    expect(nextEdition(FIRST, day("2026-11-20"))).toBe(3);
  });

  it("the approved ones go out in order, in the editions that use their section", () => {
    const assigned = assignEditions({ MITO: [{ id: "m1" }, { id: "m2" }], TRUCO: [{ id: "t1" }], PORQUE: [{ id: "p1" }], TERMOMETRO: [{ id: "q1" }, { id: "q2" }] }, 1);
    expect(Object.fromEntries(assigned)).toEqual({ m1: 1, m2: 4, t1: 1, p1: 2, q1: 1, q2: 2 });
    // From a later edition on, the first in the queue goes there.
    expect(assignEditions({ MITO: [{ id: "m1" }] }, 2).get("m1")).toBe(4);
    // Too far ahead: none yet.
    expect(assignEditions({ SABIAS: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` })) }, 1, 12).get("s5")).toBeUndefined();
  });
});

describe("a piece's content", () => {
  it("checked against its section", () => {
    expect(contentOf("MITO", { statement: "Las uñas respiran", answer: "mito", explanation: "La uña es queratina sin vida: el oxígeno le llega por la sangre." })).not.toBeNull();
    expect(contentOf("MITO", { statement: "Las uñas respiran", answer: "quizá", explanation: "x".repeat(30) })).toBeNull();
    expect(contentOf("PORQUE", { question: "¿Por qué se levanta?", causes: ["Grasa"], steps: ["a", "b", "c"] })).toBeNull();
    expect(contentOf("TERMOMETRO", { question: "¿Cobras anticipo?", options: ["Sí", "A veces", "No"] })).not.toBeNull();
  });

  it("named by its main line", () => {
    expect(summaryOf("PALABRA", { word: "Ápex" })).toBe("Ápex");
    expect(summaryOf("ASUNTO", { subject: "{nombre}, ¿mito o verdad?" })).toBe("{nombre}, ¿mito o verdad?");
    expect(summaryOf("TRUCO", null)).toBe("");
  });
});

// A stand-in for the SDK: the requests it gets, and what it answers.
function fakeClient(replies: ((body: Record<string, unknown>) => unknown)[]) {
  const calls: Record<string, unknown>[] = [];
  const create = vi.fn(async (body: Record<string, unknown>) => {
    calls.push(body);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!(body);
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, calls };
}

const message = (json: unknown, stop_reason = "end_turn") => ({
  type: "message",
  role: "assistant",
  model: MESA_MODEL,
  stop_reason,
  content: stop_reason === "refusal" ? [] : [{ type: "text", text: JSON.stringify(json) }],
  usage: { input_tokens: 10, output_tokens: 10 },
});

const badRequest = (text: string) => new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: text } }, text, new Headers());

const mito = (frase: string, respuesta = "mito") => ({ frase, respuesta, explicacion: "Casi siempre son golpecitos en la matriz y se van con el crecimiento." });

describe("Claude's ideas", () => {
  it("asks for the section in La Mesa's voice, without the ones there are, about the theme", async () => {
    const { client, calls } = fakeClient([() => message({ ideas: [mito("«Las manchas blancas son falta de calcio.»"), mito("Una capa gruesa cura peor", "verdad")] })]);
    const pieces = await proposePieces(client, "MITO", { count: 5, topic: "cutículas", avoid: ["Las uñas necesitan respirar"] });
    expect(pieces).toEqual([
      { statement: "Las manchas blancas son falta de calcio.", answer: "mito", explanation: expect.any(String) },
      { statement: "Una capa gruesa cura peor", answer: "verdad", explanation: expect.any(String) },
    ]);
    const body = calls[0]!;
    expect(body.model).toBe(MESA_MODEL);
    expect(JSON.stringify(body.system)).toContain(MESA_SYSTEM.slice(0, 60));
    const user = String((body.messages as { content: string }[])[0]!.content);
    expect(user).toContain("Mito o verdad");
    expect(user).toContain("«cutículas»");
    expect(user).toContain("- Las uñas necesitan respirar");
    expect(user).toContain("Propón 5 ideas");
    expect(body.output_config).toMatchObject({ format: { type: "json_schema" } });
  });

  it("leaves out the ones that don't fit their section; none at all is a problem to say", async () => {
    const { client } = fakeClient([() => message({ ideas: [{ pregunta: "¿Por qué se levanta el gel?", causas: ["Grasa", "Capa gruesa"], pasos: ["Limpia", "Deshidrata"] }, { pregunta: "¿Por qué arde?", causas: ["Calor", "Capa gruesa"], pasos: ["Capas finas", "Saca la mano", "Vuelve a curar"] }] })]);
    expect(await proposePieces(client, "PORQUE", { count: 5, avoid: [] })).toHaveLength(1);
    const empty = fakeClient([() => message({ ideas: [{ pregunta: "x", causas: [], pasos: [] }] })]);
    await expect(proposePieces(empty.client, "PORQUE", { count: 5, avoid: [] })).rejects.toThrow(MesaAiError);
  });

  it("an account without the fallback: once more without it", async () => {
    const { client, calls } = fakeClient([() => badRequest("Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header."), () => message({ ideas: [{ titulo: "¿El gel se corre?", truco: "Cura cada uña 10 segundos antes de pasar a la siguiente." }] })]);
    expect(await proposePieces(client, "TRUCO", { count: 1, avoid: [] })).toHaveLength(1);
    expect(calls[0]!.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(calls[1]!.betas).toBeUndefined();
  });

  it("declined, cut short or out of shape: in words for the team", async () => {
    await expect(proposePieces(fakeClient([() => message({}, "refusal")]).client, "SABIAS", { count: 1, avoid: [] })).rejects.toMatchObject({ problem: "refused" });
    await expect(proposePieces(fakeClient([() => message({ ideas: [] }, "max_tokens")]).client, "SABIAS", { count: 1, avoid: [] })).rejects.toThrow(/se cortó/);
    expect(problemOfError(new Anthropic.AuthenticationError(401, { type: "error", error: { type: "authentication_error", message: "x" } }, "x", new Headers()))).toBe("key");
    expect(problemOfError(new Error("boom"))).toBe("error");
  });

  it("subject lines from what the edition brings, with their second line and the greeting", async () => {
    const { client, calls } = fakeClient([
      () =>
        message({
          saludo: "Hoy: un mito que se oye en todos los salones y un truco de 10 segundos.",
          asuntos: [
            { asunto: "{nombre}, ¿las uñas necesitan respirar?", segunda_linea: "Mito o verdad, un truco y las uñas de la comunidad.", etiquetas: ["Pregunta", "Su nombre", "Otra"] },
            { asunto: "x", segunda_linea: "muy corto", etiquetas: [] },
          ],
        }),
    ]);
    const out = await proposeSubjects(
      client,
      { edition: 1, date: "jueves 5 de noviembre", pieces: [{ section: "MITO", content: { statement: "Las uñas necesitan respirar" } }] },
      { count: 5, avoid: ["Viejo asunto"] },
    );
    expect(out.intro).toContain("un truco de 10 segundos");
    expect(out.options).toEqual([{ subject: "{nombre}, ¿las uñas necesitan respirar?", preheader: "Mito o verdad, un truco y las uñas de la comunidad.", tags: ["Pregunta", "Su nombre"] }]);
    const user = String((calls[0]!.messages as { content: string }[])[0]!.content);
    expect(user).toContain("La edición 1 sale el jueves 5 de noviembre");
    expect(user).toContain("Mito o verdad: ");
    expect(user).toContain("- Viejo asunto");
  });
});

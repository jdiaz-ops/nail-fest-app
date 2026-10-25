import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTOPILOT_MODEL,
  AUTOPILOT_SCHEMA,
  AUTOPILOT_SYSTEM,
  contextText,
  decide,
  decisionFrom,
  proposalOf,
  tidyDescription,
  tidyTitle,
  videoText,
  type AutopilotAnswer,
  type CurationContext,
} from "./youtubeAutopilot";

afterEach(() => {
  vi.unstubAllGlobals();
});

const row = (over: Partial<Parameters<typeof videoText>[0]> = {}) => ({
  id: "row1",
  youtubeId: "abc123def45",
  title: "UÑAS ACRÍLICAS PASO A PASO 💅 #shorts",
  description: "Hoy les enseño la francesa.\nCompra aquí: https://tienda.com\n#polygel #uñas",
  durationSeconds: 58,
  views: 1200,
  publishedAt: new Date("2024-03-03T15:00:00Z"),
  short: true,
  suggestedTheme: "tecnicas",
  youtubeTags: ["uñas acrilicas"],
  ...over,
});

const answer = (over: Partial<AutopilotAnswer> = {}): AutopilotAnswer => ({
  id: "abc123def45",
  motivo: "Tutorial claro de francesa.",
  publicar: true,
  titulo: "Francesa con polygel paso a paso",
  descripcion: "Una francesa limpia con polygel. Consejo: lima la línea antes de sellar.",
  tema: "tecnicas",
  nivel: "intermedio",
  tipo: "corto",
  temas: ["polygel", "Francesa"],
  instructora: null,
  ...over,
});

const context: CurationContext = {
  channelTitle: "Nail Fest by H La Cosedora",
  instructors: [{ id: "inst1", name: "Luz Prueba", instagram: "luzprueba", city: "Cúcuta" }],
  topicsInUse: ["Polygel", "Nail art"],
};

describe("what Claude reads", () => {
  it("each video with its length, its tags and its description without links", () => {
    const text = videoText(row(), 0);
    expect(text).toContain("Video 1");
    expect(text).toContain("id: abc123def45");
    expect(text).toContain("Duración: 0:58 (corto: 3 minutos o menos)");
    expect(text).toContain("Etiquetas en YouTube: uñas acrilicas, #polygel, #uñas");
    expect(text).toContain("Descripción en YouTube: Hoy les enseño la francesa.");
    expect(text).not.toContain("https://");
  });

  it("the channel, the directory and the topics in use", () => {
    const text = contextText(context);
    expect(text).toContain("«Nail Fest by H La Cosedora»");
    expect(text).toContain("- inst1 · Luz Prueba · @luzprueba · Cúcuta");
    expect(text).toContain("Polygel, Nail art");
    expect(contextText({ ...context, instructors: [], topicsInUse: [] })).toContain("(ninguna todavía)");
  });

  it("the answer's shape: every field asked for, nothing else (structured outputs)", () => {
    const item = AUTOPILOT_SCHEMA.properties.videos.items;
    expect(item.required).toEqual(Object.keys(item.properties));
    expect(item.additionalProperties).toBe(false);
    expect(AUTOPILOT_SCHEMA.additionalProperties).toBe(false);
    expect(item.properties.tema.enum).toContain("errores");
  });
});

describe("tidying what comes back", () => {
  it("a title without emojis, hashtags, quotes or shouting", () => {
    expect(tidyTitle("UÑAS ACRÍLICAS PASO A PASO 💅 #shorts")).toBe("Uñas acrílicas paso a paso");
    expect(tidyTitle("«Francesa invertida» con cromo!!! ✨")).toBe("Francesa invertida con cromo!");
    expect(tidyTitle("Manicura rusa | @hlacosedora")).toBe("Manicura rusa");
    expect(tidyTitle("Polygel shorts")).toBe("Polygel");
    expect(tidyTitle("a".repeat(30) + " " + "b".repeat(30) + " " + "c".repeat(30)).length).toBeLessThanOrEqual(70);
  });

  it("a description without links or handles, cut after a sentence", () => {
    expect(tidyDescription("Mira el paso a paso 👉 https://x.co @tienda #uñas")).toBe("Mira el paso a paso");
    expect(tidyDescription("")).toBeNull();
    const long = `${"Primera frase con bastante texto para pasar el mínimo de ochenta caracteres sin problema."} ${"Segunda frase. ".repeat(20)}`;
    const cut = tidyDescription(long)!;
    expect(cut.length).toBeLessThanOrEqual(240);
    expect(cut.endsWith(".")).toBe(true);
  });
});

describe("a decision, checked against what the library accepts", () => {
  const ids = new Set(["inst1"]);

  it("as Claude wrote it, tidy", () => {
    const d = decisionFrom(answer({ temas: ["#polygel", "Francesa", "francesa", "  nail   art "], instructora: "inst1" }), row(), ids);
    expect(d).toEqual({
      youtubeId: "abc123def45",
      keep: true,
      reason: "Tutorial claro de francesa.",
      proposal: {
        title: "Francesa con polygel paso a paso",
        description: "Una francesa limpia con polygel. Consejo: lima la línea antes de sellar.",
        theme: "tecnicas",
        level: "intermedio",
        kind: "corto",
        tags: ["Polygel", "Francesa", "Nail art"],
        instructorId: "inst1",
      },
    });
  });

  it("three minutes or less is a corto; a longer one never is", () => {
    expect(decisionFrom(answer({ tipo: "grabacion" }), row(), ids).proposal.kind).toBe("corto");
    expect(decisionFrom(answer({ tipo: "corto" }), row({ short: false, durationSeconds: 900 }), ids).proposal.kind).toBe("video");
    expect(decisionFrom(answer({ tipo: "grabacion" }), row({ short: false, durationSeconds: 5400 }), ids).proposal.kind).toBe("grabacion");
  });

  it("nothing invented: an unknown instructor, theme or level falls back", () => {
    const d = decisionFrom(answer({ instructora: "nadie", tema: "otro", nivel: "experta" }), row({ suggestedTheme: "errores" }), ids);
    expect(d.proposal.instructorId).toBeNull();
    expect(d.proposal.theme).toBe("errores");
    expect(d.proposal.level).toBe("principiante");
  });

  it("an empty title takes YouTube's, tidy", () => {
    expect(decisionFrom(answer({ titulo: "💅💅" }), row(), ids).proposal.title).toBe("Uñas acrílicas paso a paso");
  });

  it("kept as JSON and read back", () => {
    const { proposal } = decisionFrom(answer(), row(), ids);
    expect(proposalOf(JSON.parse(JSON.stringify(proposal)))).toEqual(proposal);
    expect(proposalOf({ title: "x" })).toBeNull();
    expect(proposalOf(null)).toBeNull();
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

const message = (videos: AutopilotAnswer[], stop_reason = "end_turn") => ({
  type: "message",
  role: "assistant",
  model: AUTOPILOT_MODEL,
  stop_reason,
  content: [{ type: "thinking", thinking: "", signature: "x" }, ...(stop_reason === "refusal" ? [] : [{ type: "text", text: JSON.stringify({ videos }) }])],
  usage: { input_tokens: 10, output_tokens: 10 },
});

const badRequest = (text: string) => new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: text } }, text, new Headers());

describe("asking Claude", () => {
  const two = [row(), row({ id: "row2", youtubeId: "zzz999yyy88", title: "Sorteo de un kit", short: false, durationSeconds: 400 })];
  const noStills = () => vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));

  it("one request for the batch: the model, its effort, the answer's shape, the fallback and the cached prompt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(5000), { status: 200, headers: { "content-type": "image/jpeg" } })));
    const { client, calls } = fakeClient([() => message([answer(), answer({ id: "zzz999yyy88", publicar: false, motivo: "Es un sorteo." }), answer({ id: "otro" })])]);
    const decisions = await decide(client, two, context, { stills: true, fallbacks: true });
    expect(calls).toHaveLength(1);
    const body = calls[0]!;
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(body.fallbacks).toBe("default");
    expect(body.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema: AUTOPILOT_SCHEMA } });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("temperature");
    const system = body.system as { text: string; cache_control?: unknown }[];
    expect(system[0]!.text).toBe(AUTOPILOT_SYSTEM);
    expect(system.every((s) => s.cache_control)).toBe(true);
    const content = (body.messages as { content: { type: string }[] }[])[0]!.content;
    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
    // Only the videos asked about.
    expect([...decisions.keys()]).toEqual(["abc123def45", "zzz999yyy88"]);
    expect(decisions.get("zzz999yyy88")).toMatchObject({ keep: false, reason: "Es un sorteo." });
  });

  it("declined as a whole: asked again one by one; one declined alone has no decision", async () => {
    noStills();
    const { client, calls } = fakeClient([
      () => message([], "refusal"),
      () => message([answer()]),
      () => message([], "refusal"),
    ]);
    const decisions = await decide(client, two, context, { stills: true, fallbacks: true });
    expect(calls).toHaveLength(3);
    expect([...decisions.keys()]).toEqual(["abc123def45"]);
  });

  it("an account without the fallback: asked again without it, and the rest of the run too", async () => {
    noStills();
    const { client, calls } = fakeClient([() => badRequest("Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header."), () => message([answer()])]);
    const options = { stills: true, fallbacks: true };
    const decisions = await decide(client, [row()], context, options);
    expect(decisions.size).toBe(1);
    expect(calls[1]).not.toHaveProperty("fallbacks");
    expect(calls[1]).not.toHaveProperty("betas");
    expect(options.fallbacks).toBe(false);
  });

  it("a still Claude couldn't read: asked again without the stills", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(5000), { status: 200, headers: { "content-type": "image/jpeg" } })));
    const { client, calls } = fakeClient([() => badRequest("messages.0.content.1.image: Could not process image"), () => message([answer()])]);
    const decisions = await decide(client, [row()], context, { stills: true, fallbacks: true });
    expect(decisions.size).toBe(1);
    const second = (calls[1]!.messages as { content: { type: string }[] }[])[0]!.content;
    expect(second.some((c) => c.type === "image")).toBe(false);
  });

  it("an answer cut short or out of shape is an error, not a decision", async () => {
    noStills();
    await expect(decide(fakeClient([() => message([answer()], "max_tokens")]).client, [row()], context, { stills: false, fallbacks: true })).rejects.toThrow(/se cortó/);
    const broken = { ...message([]), content: [{ type: "text", text: "{nada" }] };
    await expect(decide(fakeClient([() => broken]).client, [row()], context, { stills: false, fallbacks: true })).rejects.toThrow(/formato/);
  });
});

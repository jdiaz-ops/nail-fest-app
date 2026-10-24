import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const db = vi.hoisted(() => {
  const mock = {
    consultorioQuestion: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    consultorioAnswer: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    consultorioVote: { create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  // A list of writes, or a function given the same mocks as its transaction.
  mock.$transaction.mockImplementation(async (ops: unknown) => (typeof ops === "function" ? (ops as (tx: typeof mock) => unknown)(mock) : Promise.all(ops as unknown[])));
  return mock;
});
vi.mock("@/lib/db", () => ({ db }));
const { consultorioPoster } = vi.hoisted(() => ({ consultorioPoster: vi.fn() }));
vi.mock("@/lib/community/gate", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/community/gate")>()), consultorioPoster }));

import { POST as ask } from "./preguntas/route";
import { POST as answer } from "./preguntas/[id]/respuestas/route";
import { POST as best } from "./preguntas/[id]/mejor/route";
import { POST as useful } from "./respuestas/[id]/me-sirvio/route";

const LAURA = { kind: "MEMBER", member: { id: "m1", name: "Laura", city: "Cúcuta", blocked: false } };
const ANA = { kind: "INSTRUCTOR", instructor: { id: "i1", name: "Ana", city: "Cúcuta" }, listed: true };
const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (ops: unknown) => (typeof ops === "function" ? (ops as (tx: typeof db) => unknown)(db) : Promise.all(ops as unknown[])));
  consultorioPoster.mockResolvedValue({ identity: LAURA });
  db.consultorioQuestion.count.mockResolvedValue(0);
  db.consultorioAnswer.count.mockResolvedValue(0);
  db.consultorioQuestion.findUnique.mockResolvedValue(null);
  db.consultorioQuestion.create.mockImplementation(async ({ data }: { data: { slug: string } }) => ({ id: "q1", ...data }));
});

describe("Haz tu pregunta", () => {
  const QUESTION = { topic: "productos", title: "¿Por qué se pone amarillo el top coat?", body: "Me pasa con todas las marcas." };

  it("goes up with who asked, at an address from its title", async () => {
    const res = await ask(post("/api/consultorio/preguntas", QUESTION));
    expect(await res.json()).toEqual({ ok: true, slug: "por-que-se-pone-amarillo-el-top-coat" });
    expect(db.consultorioQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorKind: "MEMBER", memberId: "m1", instructorId: null, adminUserId: null, topic: "productos", photoUrl: null }),
    });
  });

  it("needs someone signed in (the gate's answer goes back as it is)", async () => {
    consultorioPoster.mockResolvedValue({ response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    expect((await ask(post("/api/consultorio/preguntas", QUESTION))).status).toBe(401);
  });

  it("five a day at most, and only her own photo", async () => {
    db.consultorioQuestion.count.mockResolvedValue(5);
    expect((await ask(post("/api/consultorio/preguntas", QUESTION))).status).toBe(429);
    db.consultorioQuestion.count.mockResolvedValue(0);
    const res = await ask(post("/api/consultorio/preguntas", { ...QUESTION, photoUrl: "https://x.public.blob.vercel-storage.com/consultorio/m-otra/foto.jpg" }));
    expect(res.status).toBe(400);
    const mine = await ask(post("/api/consultorio/preguntas", { ...QUESTION, photoUrl: "https://x.public.blob.vercel-storage.com/consultorio/m-m1/foto.jpg" }));
    expect(mine.status).toBe(200);
  });

  it("no links or phones, in words", async () => {
    const res = await ask(post("/api/consultorio/preguntas", { ...QUESTION, body: "Escríbeme al 300 123 4567" }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Para cuidar el Consultorio no se permiten teléfonos.");
  });
});

describe("an answer", () => {
  it("goes up right away and takes the question back to the top", async () => {
    db.consultorioQuestion.findFirst.mockResolvedValue({ id: "q1" });
    db.consultorioAnswer.create.mockResolvedValue({ id: "a1" });
    const res = await answer(post("/api/consultorio/preguntas/q1/respuestas", { body: "Cura cada capa el tiempo completo." }), { params: { id: "q1" } });
    expect(await res.json()).toEqual({ ok: true, id: "a1" });
    expect(db.consultorioQuestion.update).toHaveBeenCalledWith({ where: { id: "q1" }, data: { answerCount: { increment: 1 }, lastActivityAt: expect.any(Date) } });
  });

  it("not to a question that's gone", async () => {
    db.consultorioQuestion.findFirst.mockResolvedValue(null);
    expect((await answer(post("/api/consultorio/preguntas/q1/respuestas", { body: "Hola" }), { params: { id: "q1" } })).status).toBe(404);
  });
});

describe("«Me sirvió»", () => {
  const ANSWER = { id: "a1", authorKind: "INSTRUCTOR", memberId: null, instructorId: "i1", adminUserId: null };

  it("counts once per person, and comes off again", async () => {
    db.consultorioAnswer.findFirst.mockResolvedValue(ANSWER);
    db.consultorioAnswer.findUnique.mockResolvedValue({ usefulCount: 4 });
    let res = await useful(post("/api/consultorio/respuestas/a1/me-sirvio", { on: true }), { params: { id: "a1" } });
    expect(await res.json()).toEqual({ ok: true, usefulCount: 4 });
    expect(db.consultorioVote.create).toHaveBeenCalledWith({ data: { answerId: "a1", memberId: "m1" } });
    expect(db.consultorioAnswer.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { usefulCount: { increment: 1 } } });

    db.consultorioVote.deleteMany.mockResolvedValue({ count: 1 });
    res = await useful(post("/api/consultorio/respuestas/a1/me-sirvio", { on: false }), { params: { id: "a1" } });
    expect(res.status).toBe(200);
    expect(db.consultorioAnswer.update).toHaveBeenLastCalledWith({ where: { id: "a1" }, data: { usefulCount: { decrement: 1 } } });
  });

  it("never for one's own answer", async () => {
    consultorioPoster.mockResolvedValue({ identity: ANA });
    db.consultorioAnswer.findFirst.mockResolvedValue(ANSWER);
    const res = await useful(post("/api/consultorio/respuestas/a1/me-sirvio", { on: true }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(db.consultorioVote.create).not.toHaveBeenCalled();
  });
});

describe("«La que me resolvió»", () => {
  it("only whoever asked marks it", async () => {
    db.consultorioQuestion.findUnique.mockResolvedValue({ id: "q1", authorKind: "MEMBER", memberId: "otra", instructorId: null, adminUserId: null });
    expect((await best(post("/api/consultorio/preguntas/q1/mejor", { answerId: "a1" }), { params: { id: "q1" } })).status).toBe(403);

    db.consultorioQuestion.findUnique.mockResolvedValue({ id: "q1", authorKind: "MEMBER", memberId: "m1", instructorId: null, adminUserId: null });
    db.consultorioAnswer.findFirst.mockResolvedValue({ id: "a1" });
    expect((await best(post("/api/consultorio/preguntas/q1/mejor", { answerId: "a1" }), { params: { id: "q1" } })).status).toBe(200);
    expect(db.consultorioQuestion.update).toHaveBeenCalledWith({ where: { id: "q1" }, data: { bestAnswerId: "a1" } });
  });

  it("an answer of another question can't be it", async () => {
    db.consultorioQuestion.findUnique.mockResolvedValue({ id: "q1", authorKind: "MEMBER", memberId: "m1", instructorId: null, adminUserId: null });
    db.consultorioAnswer.findFirst.mockResolvedValue(null);
    expect((await best(post("/api/consultorio/preguntas/q1/mejor", { answerId: "de-otra" }), { params: { id: "q1" } })).status).toBe(404);
  });
});

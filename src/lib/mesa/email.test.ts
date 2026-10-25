import { beforeAll, describe, expect, it } from "vitest";
import { cityKey, cityLine, mesaEmail, percentages, personalize, resultsSentence, sayName, shareWords, type MesaEditionSnapshot, type MesaRecipient } from "./email";
import { assignEditions, bogotaDateTime, bogotaInputValue, fromBogotaInput, tinyDate } from "./sections";
import { readVoteToken, voteToken } from "./votes";

const BASE = "https://nailfest.lat";

const snapshot = (over: Partial<MesaEditionSnapshot> = {}): MesaEditionSnapshot => ({
  edition: 1,
  date: "jueves 5 de noviembre",
  dateShort: "jue 5 nov",
  subject: "{nombre}, ¿las uñas necesitan respirar?",
  preheader: "Mito o verdad, la primera encuesta y un truco de 10 segundos.",
  intro: "Hoy: un mito que se oye en todos los salones y un truco para que el gel no se corra.",
  pieces: [
    { id: "pmito", section: "MITO", content: { statement: "Las uñas necesitan respirar entre un esmaltado y otro.", answer: "mito", explanation: "La uña no respira: el oxígeno le llega por la sangre, no por el aire." } },
    { id: "ptermo", section: "TERMOMETRO", content: { question: "¿Cuántas clientas atiendes un sábado?", options: ["1 a 3", "4 a 6", "7 o más"] } },
    { id: "ptruco", section: "TRUCO", content: { title: "¿El gel se te corre a la cutícula?", trick: "Pinta una uña y cúrala 10 segundos antes de pasar a la siguiente." } },
  ],
  results: null,
  firstTermometro: true,
  consultorio: null,
  doors: { consultorio: false, instructoras: true, cuponera: false },
  replies: true,
  ...over,
});

const laura: MesaRecipient = {
  firstName: "laura marcela",
  city: "Cúcuta",
  voteUrl: (pieceId, option) => `${BASE}/la-mesa/voto/p-${pieceId}-${option}`,
  unsubscribeUrl: `${BASE}/api/unsubscribe?token=abc`,
};

describe("La Mesa's words for each person", () => {
  it("says the first name as it's said", () => {
    expect(sayName("laura marcela")).toBe("Laura");
    expect(sayName("MARÍA JOSÉ")).toBe("María");
    expect(sayName("  ")).toBe("");
    expect(sayName("ana@correo.com")).toBe("");
    expect(sayName("3001234567")).toBe("");
  });

  it("puts the name where {nombre} is, and without one the sentence still reads", () => {
    expect(personalize("{nombre}, ¿las uñas necesitan respirar?", "Laura")).toBe("Laura, ¿las uñas necesitan respirar?");
    expect(personalize("{nombre}, ¿las uñas necesitan respirar?", "")).toBe("¿Las uñas necesitan respirar?");
    expect(personalize("Esto es para ti, {nombre}", "")).toBe("Esto es para ti");
    expect(personalize("Hola {nombre}: tu Mesa", "")).toBe("Hola: tu Mesa");
    expect(personalize("Sin nombre aquí", "")).toBe("Sin nombre aquí");
  });
});

describe("El termómetro's results", () => {
  it("whole percentages that add up to 100", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([75, 153, 84]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(percentages([0, 0])).toEqual([0, 0]);
  });

  it("says the share in words, with the verb in step", () => {
    expect(shareWords(76)).toEqual({ words: "3 de cada 4", plural: true });
    expect(shareWords(49)).toEqual({ words: "Casi la mitad", plural: false });
    expect(shareWords(50)).toEqual({ words: "La mitad", plural: false });
    expect(shareWords(12)).toEqual({ words: "El 12%", plural: false });
    expect(resultsSentence(["1 a 3", "4 a 6", "7 o más"], [75, 153, 84])).toBe("Casi la mitad respondió «4 a 6».");
    expect(resultsSentence(["Sí", "No"], [210, 90])).toBe("2 de cada 3 respondieron «Sí».");
    expect(resultsSentence(["Sí", "A veces", "No"], [40, 40, 20])).toBe("Quedó empatado entre «Sí» y «A veces».");
  });

  it("her city's line: accents and capitals don't make another city", () => {
    const results = {
      pieceId: "ptermo",
      edition: 1,
      question: "¿Cuántas clientas atiendes un sábado?",
      options: ["1 a 3", "4 a 6", "7 o más"],
      votes: [75, 153, 84],
      total: 312,
      byCity: [{ key: cityKey("Cúcuta"), label: "Cúcuta", votes: [5, 13, 7], total: 25 }],
    };
    expect(cityKey(" CUCUTA ")).toBe("cucuta");
    expect(cityLine(results, "cucuta")).toBe("En Cúcuta, la más votada fue «4 a 6» (52%).");
    expect(cityLine(results, "Pasto")).toBeNull();
  });
});

describe("the rotation around scheduled editions", () => {
  it("a scheduled edition keeps its own pieces: the queue skips it", () => {
    const assigned = assignEditions({ MITO: [{ id: "a" }, { id: "b" }] }, 1, 36, new Set([1]));
    expect(assigned.get("a")).toBe(4);
    expect(assigned.get("b")).toBe(7);
  });
});

describe("times for the team, in Bogotá", () => {
  it("reads and writes 7:00 a. m. in Colombia", () => {
    const at = new Date("2026-11-05T12:00:00Z");
    expect(bogotaDateTime(at)).toBe("jue 5 nov, 7:00 a. m.");
    expect(bogotaDateTime(new Date("2026-11-05T23:30:00Z"))).toBe("jue 5 nov, 6:30 p. m.");
    expect(bogotaInputValue(at)).toBe("2026-11-05T07:00");
    expect(fromBogotaInput("2026-11-05T07:00")?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(fromBogotaInput("mañana")).toBeNull();
    expect(tinyDate(new Date("2026-11-18T00:00:00Z"))).toBe("mié 18 nov");
  });
});

describe("La Mesa's email", () => {
  it("is hers: her name, her city, her links to vote, her way out", () => {
    const email = mesaEmail(snapshot(), laura, { baseUrl: BASE });
    expect(email.subject).toBe("Laura, ¿las uñas necesitan respirar?");
    expect(email.html).toContain("Hola, Laura.");
    expect(email.html).toContain("Para Laura · Cúcuta");
    for (const option of [0, 1]) expect(email.html).toContain(`${BASE}/la-mesa/voto/p-pmito-${option}`);
    for (const option of [0, 1, 2]) expect(email.html).toContain(`${BASE}/la-mesa/voto/p-ptermo-${option}`);
    expect(email.html).toContain(laura.unsubscribeUrl!);
    expect(email.html).toContain("La primera encuesta de La Mesa");
    expect(email.html).not.toContain("{nombre}");
    // The doors: only the public ones, tagged as coming from this edition.
    expect(email.html).toContain("utm_campaign=la-mesa-1");
    expect(email.html).toContain("Instructoras");
    expect(email.html).not.toContain(">Cuponera<");
    // Gmail cuts emails past ~102 KB.
    expect(Buffer.byteLength(email.html)).toBeLessThan(60_000);
    expect(email.text).toContain(`Mito: ${BASE}/la-mesa/voto/p-pmito-0`);
  });

  it("without a name it still greets; with last time's results it shows them, and her city's", () => {
    const email = mesaEmail(
      snapshot({
        edition: 2,
        firstTermometro: false,
        results: {
          pieceId: "old",
          edition: 1,
          question: "¿Cuántas clientas atiendes un sábado?",
          options: ["1 a 3", "4 a 6", "7 o más"],
          votes: [75, 153, 84],
          total: 312,
          byCity: [{ key: "cucuta", label: "Cúcuta", votes: [5, 13, 7], total: 25 }],
        },
      }),
      { ...laura, firstName: null },
      { baseUrl: BASE },
    );
    expect(email.subject).toBe("¿Las uñas necesitan respirar?");
    expect(email.html).toContain("Hola.");
    expect(email.html).toContain("La quincena pasada te preguntamos");
    expect(email.html).toContain("49%");
    expect(email.html).toContain("Casi la mitad respondió «4 a 6».");
    expect(email.html).toContain("En Cúcuta, la más votada fue «4 a 6» (52%).");
    expect(email.html).toContain("Votaron 312 personas de la comunidad.");
    expect(email.html).not.toContain("La primera encuesta de La Mesa");
  });

  it("El Consultorio only when it's public", () => {
    const email = mesaEmail(
      snapshot({
        consultorio: {
          featured: { slug: "top-coat-amarillo", title: "¿Cómo hago para que el top coat no se ponga amarillo?", answers: 42, answer: { author: "Paola", city: "Medellín", body: "Cura cada capa el tiempo completo." } },
          waiting: [{ slug: "lampara", title: "¿Qué lámpara me recomiendan para empezar?", author: "Diana", city: "Bucaramanga", answers: 0 }],
        },
      }),
      laura,
      { baseUrl: BASE },
    );
    expect(email.html).toContain("La pregunta más comentada");
    expect(email.html).toContain(`${BASE}/consultorio/top-coat-amarillo?utm_source=email`);
    expect(email.html).toContain("Esperan tu respuesta");
    expect(email.html).toContain(`${BASE}/consultorio/preguntar?`);
    expect(mesaEmail(snapshot(), laura, { baseUrl: BASE }).html).not.toContain("El Consultorio");
  });
});

describe("the vote links", () => {
  beforeAll(() => {
    process.env.APP_SECRET_KEY ??= "test-secret";
  });

  it("are signed for her, the piece and the option; a preview's for nobody", () => {
    const token = voteToken("cperson1", "cpiece1", 2);
    expect(readVoteToken(token)).toEqual({ personId: "cperson1", pieceId: "cpiece1", option: 2 });
    expect(readVoteToken(token.replace(".2.", ".1."))).toBeNull();
    expect(readVoteToken(`${token}x`)).toBeNull();
    expect(readVoteToken("nada")).toBeNull();
    expect(readVoteToken(voteToken(null, "cpiece1", 0))).toEqual({ personId: null, pieceId: "cpiece1", option: 0 });
  });
});

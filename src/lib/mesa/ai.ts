import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MESA_CONTENT, MESA_SECTIONS, NAME_TOKEN, type AsuntoContent, type MesaContent, type MesaPieceSection } from "./sections";

// La Mesa's ideas (2026-10-25): Claude proposes the pieces of each section,
// El termómetro's questions and each edition's subject lines — in La Mesa's
// voice, only what's established in the trade, nothing already in the bank
// — and the team approves them or asks for another (./data.ts). The same
// model and request as the YouTube autopilot (lib/library/youtubeAutopilot.ts).

export const MESA_MODEL = "claude-opus-5-5";

export type MesaAiProblem = "key" | "credit" | "busy" | "refused" | "error";

/** What to tell the team, in words. */
export const MESA_AI_PROBLEMS: Record<MesaAiProblem, string> = {
  key: "Falta la llave de Claude, o la que hay no sirve: pégala arriba, en «La llave de Claude».",
  credit: "La cuenta de Claude se quedó sin saldo: recárgala en console.anthropic.com → Billing y vuelve a pedir ideas.",
  busy: "Claude está muy ocupado en este momento: vuelve a intentarlo en un minuto.",
  refused: "La IA no quiso escribir sobre eso. Prueba con otro tema.",
  error: "Algo falló con la IA: vuelve a intentarlo en un momento.",
};

export class MesaAiError extends Error {
  constructor(readonly problem: MesaAiProblem, detail?: string) {
    super(detail ?? MESA_AI_PROBLEMS[problem]);
  }
}

export function problemOfError(error: unknown): MesaAiProblem {
  if (error instanceof MesaAiError) return error.problem;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "key";
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) return "busy";
  if (error instanceof Anthropic.APIError && (error.status === 402 || /credit balance/i.test(error.message))) return "credit";
  return "error";
}

// ── What Claude reads ───────────────────────────────────────────────────────

export const MESA_SYSTEM = `Escribes para La Mesa, el correo de Nail Fest que llega cada 15 días, el jueves, a su comunidad: manicuristas, técnicas de uñas y estudiantes de Colombia y Latinoamérica. Nail Fest organiza eventos de uñas en Colombia.

Cómo escribes:
- En español, de tú, cercano y claro, como una colega con experiencia que le habla a otra en el salón. Frases cortas.
- Sin emojis, sin mayúsculas sostenidas y sin signos de exclamación de más.
- Sin marcas de productos y sin nombres de personas reales.
- Sin precios ni cifras inventadas.

La verdad primero:
- Solo propones lo que es conocimiento establecido del oficio o de la salud de las uñas. Si no estás segura de algo, no lo propones.
- Nada de diagnósticos: cuando algo puede ser una infección, un hongo o una alergia, la recomendación es que lo vea un médico o un dermatólogo.
- Nunca sugieres algo que vaya contra la higiene, la esterilización o el uso correcto de los productos: nada de diluir productos con lo que no es, reutilizar lo desechable o curar menos de lo indicado.

Cada pieza sirve sola, sin contexto, y es distinta de las que ya existen (te paso la lista): ni repetida ni el mismo tema con otras palabras.`;

const GUIDES: Record<MesaPieceSection, string> = {
  MITO: `Sección «Mito o verdad»: una frase que se oye en los salones o entre las clientas, y si es mito o verdad. La explicación dice por qué en una o dos frases (máximo 300 caracteres) y deja algo práctico. Mezcla mitos y verdades: no todas son mito.
Ejemplos del tono:
- «Las manchas blancas en las uñas son falta de calcio.» Mito. Casi siempre son golpecitos en la matriz, la zona donde nace la uña, y se van con el crecimiento. Si son muchas o no se van, que la vea un médico.
- «Una capa gruesa de gel cura peor que dos finas.» Verdad. La luz de la lámpara no alcanza el fondo de una capa gruesa: abajo queda gel sin curar, que se levanta y puede causar alergia.`,
  PALABRA: `Sección «La palabra»: una palabra o expresión del oficio que no todas conocen bien (técnica, anatomía de la uña, materiales, herramientas). El tipo es «sustantivo», «verbo» o «expresión». La definición, en una o dos frases claras. El ejemplo, una frase como se diría en el salón.
Ejemplo del tono: «Capa de dispersión» (sustantivo): la capa pegajosa que queda sobre el gel después de curarlo; ayuda a que la siguiente capa se pegue y, al terminar, se limpia. Ejemplo: «No limpies la capa de dispersión entre capa y capa: es la que hace que se peguen.»`,
  SABIAS: `Sección «¿Sabías que…?»: un dato curioso y verificable sobre las uñas, su historia, su biología o el oficio. El dato es una frase que sorprende (máximo 200 caracteres); el detalle, una o dos frases que lo explican o dicen por qué le sirve a una manicurista. Solo datos establecidos: si una cifra no es exacta, dila aproximada («unos», «más o menos») o no la uses.
Ejemplo del tono: Una uña de la mano tarda unos 6 meses en renovarse completa; una del pie, entre 12 y 18. Por eso un golpe en la matriz se sigue viendo durante meses: la marca sube con la uña hasta que llega al borde.`,
  TRUCO: `Sección «El truco»: un truco práctico que ahorra tiempo, material o un error, y que cualquier manicurista puede probar en su próxima clienta. El título es el problema que resuelve, como pregunta corta. El truco, la solución en una o dos frases (máximo 300 caracteres).
Ejemplo del tono: «¿El gel se te corre a la cutícula?» Pinta una uña y cúrala 10 segundos antes de pasar a la siguiente. Así no alcanza a correrse mientras pintas las demás.`,
  PORQUE: `Sección «¿Por qué pasó?»: un problema común del trabajo (algo que se levanta, se quiebra, se mancha, arde o dura poco) explicado. La pregunta empieza por «¿Por qué…?». Las causas, de 2 a 4, cortas. Los pasos para evitarlo, exactamente 3, en orden y cortos.
Ejemplo del tono: «¿Por qué se levanta el gel cerca de la cutícula?» Causas: quedó piel sobre la uña; la capa quedó gruesa en esa zona; la uña tenía grasa o humedad. Pasos: retira bien la cutícula de la uña; limpia y deshidrata antes de la base; deja un filito sin producto junto a la piel y aplica capas finas.`,
  TERMOMETRO: `Sección «El termómetro»: una pregunta de encuesta para la comunidad, que se responde en un toque y cuyos resultados den curiosidad de ver y compartir: precios, clientas, horarios, técnicas, materiales, hábitos del negocio. Nada personal ni sensible (salud, ingresos exactos, política, religión). Las opciones, de 2 a 4, cortas (máximo 25 caracteres), que no se crucen entre sí y cubran todas las respuestas posibles.
Ejemplo del tono: «¿Cobras anticipo para separar la cita?» Sí, siempre / A veces / No.`,
};

const SUBJECT_GUIDE = `Escribes los asuntos de una edición de La Mesa. Te paso lo que trae.
- El asunto: máximo 50 caracteres (sin contar ${NAME_TOKEN}), que den ganas de abrir sin engañar: solo promete lo que trae la edición. El gancho puede ser la pieza para jugar, el truco o el problema, o la pregunta del termómetro.
- Cambia de fórmula entre los 5: una pregunta, un número, una curiosidad, un problema real, algo útil.
- Puedes poner ${NAME_TOKEN} (el nombre de cada persona) en uno o dos de los 5, nunca en todos.
- La segunda línea es la que se ve gris después del asunto en la bandeja: máximo 90 caracteres, completa el asunto con el resto de la edición.
- Las etiquetas, 1 o 2 de: Pregunta, Número, Curiosidad, Útil, Problema real, Encuesta, Su nombre.
- El saludo va después de «Hola, ${NAME_TOKEN}.»: una o dos frases (máximo 260 caracteres) que cuentan qué trae la edición, sin repetir el asunto palabra por palabra.`;

const SUBJECT_TAGS = ["Pregunta", "Número", "Curiosidad", "Útil", "Problema real", "Encuesta", "Su nombre"];

// ── What Claude answers ─────────────────────────────────────────────────────

type JsonSchema = Record<string, unknown>;

const str = (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) });
const list = (description: string): JsonSchema => ({ type: "array", items: { type: "string" }, description });
const ideasSchema = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties: { ideas: { type: "array", items: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } } },
  required: ["ideas"],
  additionalProperties: false,
});

const SCHEMAS: Record<MesaPieceSection, JsonSchema> = {
  MITO: ideasSchema({ frase: str("La frase, sin comillas."), respuesta: { type: "string", enum: ["mito", "verdad"] }, explicacion: str() }),
  PALABRA: ideasSchema({ palabra: str(), tipo: str("sustantivo, verbo o expresión"), definicion: str(), ejemplo: str("Una frase, sin comillas.") }),
  SABIAS: ideasSchema({ dato: str(), detalle: str() }),
  TRUCO: ideasSchema({ titulo: str("El problema, como pregunta corta."), truco: str() }),
  PORQUE: ideasSchema({ pregunta: str(), causas: list("De 2 a 4."), pasos: list("Exactamente 3.") }),
  TERMOMETRO: ideasSchema({ pregunta: str(), opciones: list("De 2 a 4, cortas.") }),
};

const SUBJECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    saludo: str(),
    asuntos: {
      type: "array",
      items: {
        type: "object",
        properties: { asunto: str(), segunda_linea: str(), etiquetas: { type: "array", items: { type: "string", enum: SUBJECT_TAGS } } },
        required: ["asunto", "segunda_linea", "etiquetas"],
        additionalProperties: false,
      },
    },
  },
  required: ["saludo", "asuntos"],
  additionalProperties: false,
};

const unquote = (value: string) => value.trim().replace(/^[«"“']+|[»"”']+$/g, "").trim();

/** Claude's answer for a section, as the bank stores it. */
function fromClaude(section: MesaPieceSection, idea: Record<string, unknown>): unknown {
  const s = (key: string) => (typeof idea[key] === "string" ? (idea[key] as string) : "");
  const a = (key: string) => (Array.isArray(idea[key]) ? (idea[key] as unknown[]).filter((x): x is string => typeof x === "string") : []);
  switch (section) {
    case "MITO":
      return { statement: unquote(s("frase")), answer: s("respuesta"), explanation: s("explicacion") };
    case "PALABRA":
      return { word: unquote(s("palabra")), kind: s("tipo"), definition: s("definicion"), example: unquote(s("ejemplo")) };
    case "SABIAS":
      return { fact: s("dato"), detail: s("detalle") };
    case "TRUCO":
      return { title: unquote(s("titulo")), trick: s("truco") };
    case "PORQUE":
      return { question: unquote(s("pregunta")), causes: a("causas"), steps: a("pasos") };
    case "TERMOMETRO":
      return { question: unquote(s("pregunta")), options: a("opciones") };
  }
}

// ── Asking ──────────────────────────────────────────────────────────────────

/** The Messages API's piece this module uses: a fake one in the tests. */
export type MesaClient = Pick<Anthropic, "beta">;

interface AskOptions {
  /** The server-side fallback (another model takes over a declined request);
   * off only when this account's API doesn't take it. */
  fallbacks: boolean;
}

async function ask(client: MesaClient, user: string, schema: JsonSchema, options: AskOptions = { fallbacks: true }): Promise<unknown> {
  let response: Anthropic.Beta.Messages.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MESA_MODEL,
      max_tokens: 8000,
      ...(options.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: MESA_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
  } catch (error) {
    // An account without the fallback: once more without it.
    if (options.fallbacks && error instanceof Anthropic.BadRequestError && /anthropic-beta|fallback/i.test(error.message)) {
      return ask(client, user, schema, { fallbacks: false });
    }
    throw error;
  }
  if (response.stop_reason === "refusal") throw new MesaAiError("refused");
  if (response.stop_reason === "max_tokens") throw new MesaAiError("error", "La respuesta de Claude se cortó.");
  const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new MesaAiError("error", "La respuesta de Claude no vino en el formato esperado.");
  }
}

function avoidText(avoid: string[]): string {
  const known = avoid.map((line) => line.trim()).filter(Boolean);
  return known.length ? `Ya existen (no las repitas ni repitas su tema):\n${known.map((line) => `- ${line}`).join("\n")}` : "Todavía no hay ninguna en el banco.";
}

/** `count` new pieces for a section, about `topic` if there is one, none
 * like the ones in `avoid`. Those that don't fit the section are left out. */
export async function proposePieces<S extends MesaPieceSection>(
  client: MesaClient,
  section: S,
  { count, topic, avoid }: { count: number; topic?: string | null; avoid: string[] },
): Promise<MesaContent<S>[]> {
  const user = [
    GUIDES[section],
    topic ? `Tema pedido: «${topic}». Todas las ideas son sobre ese tema.` : "",
    avoidText(avoid),
    count === 1 ? "Propón 1 idea." : `Propón ${count} ideas distintas entre sí.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const answer = z.object({ ideas: z.array(z.record(z.string(), z.unknown())) }).safeParse(await ask(client, user, SCHEMAS[section]));
  if (!answer.success) throw new MesaAiError("error", "La respuesta de Claude no vino en el formato esperado.");
  const pieces = answer.data.ideas
    .map((idea) => MESA_CONTENT[section].safeParse(fromClaude(section, idea)))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data as MesaContent<S>);
  if (pieces.length === 0) throw new MesaAiError("error", "La IA no trajo ideas que sirvan esta vez: vuelve a pedirlas.");
  return pieces.slice(0, count);
}

/** What an edition brings, for its subject lines: each section and its piece. */
export interface EditionForSubjects {
  edition: number;
  date: string;
  pieces: { section: MesaPieceSection; content: unknown }[];
}

function editionText({ edition, date, pieces }: EditionForSubjects): string {
  const lines = pieces.map(({ section, content }) => `- ${MESA_SECTIONS[section].name}: ${JSON.stringify(content)}`);
  return `La edición ${edition} sale el ${date} y trae, en este orden:\n${lines.join("\n")}\n- La galería: las uñas más lindas que mandó la comunidad.\n- El Consultorio: la pregunta más comentada de la quincena y su mejor respuesta.`;
}

/** `count` subject lines for an edition (with the second line the inbox
 * shows) and its greeting, none like the ones in `avoid`. */
export async function proposeSubjects(
  client: MesaClient,
  edition: EditionForSubjects,
  { count, avoid }: { count: number; avoid: string[] },
): Promise<{ intro: string; options: Omit<AsuntoContent, "intro" | "pieceIds">[] }> {
  const user = [SUBJECT_GUIDE, editionText(edition), avoidText(avoid), count === 1 ? "Propón 1 asunto." : `Propón ${count} asuntos distintos entre sí.`].join("\n\n");
  const answer = z
    .object({ saludo: z.string(), asuntos: z.array(z.object({ asunto: z.string(), segunda_linea: z.string(), etiquetas: z.array(z.string()) })) })
    .safeParse(await ask(client, user, SUBJECT_SCHEMA));
  if (!answer.success) throw new MesaAiError("error", "La respuesta de Claude no vino en el formato esperado.");
  const intro = answer.data.saludo.trim();
  const options = answer.data.asuntos
    .map((a) => ({ subject: unquote(a.asunto), preheader: a.segunda_linea.trim(), tags: a.etiquetas.filter((t) => SUBJECT_TAGS.includes(t)).slice(0, 2) }))
    .filter((o) => MESA_CONTENT.ASUNTO.safeParse({ ...o, intro, pieceIds: [] }).success);
  if (options.length === 0) throw new MesaAiError("error", "La IA no trajo asuntos que sirvan esta vez: vuelve a pedirlos.");
  return { intro, options: options.slice(0, count) };
}

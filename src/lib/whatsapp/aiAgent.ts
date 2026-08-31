import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
// betaZodTool's schema type comes from zod's newer v4 API surface, not
// the classic v3 namespace the rest of this app imports from "zod" — the
// installed zod (3.25+) ships both under one package; this subpath is
// the one that structurally matches what the SDK helper expects.
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { addNote } from "./notes";
import { sendTicketPdfViaWhatsApp, listResendableRegistrations } from "./sendTicketPdf";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MODEL = "claude-sonnet-5";
// How much conversation history to give the model — enough for real
// context (a customer references something they said a few messages
// ago) without letting one very chatty thread balloon the request.
const HISTORY_MESSAGE_LIMIT = 20;

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

/** Rich-text event descriptions are sanitized HTML (see
 * lib/sanitizeHtml.ts) — fine to render, useless as LLM context with the
 * tags still in it. Good-enough stripping for a system prompt, not a
 * rendering path anyone sees. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Real, current event data — the ONLY source of truth the agent is
 * allowed to quote dates/prices/addresses from. Prioritizes whichever
 * event(s) the person already has a registration for (most relevant to
 * *this* conversation), then the nearest upcoming published events
 * generally, so the model can ground an answer even for a stranger who
 * never registered, or ask a clarifying question ("¿Bogotá o
 * Bucaramanga?") when more than one is plausibly relevant. */
async function buildEventContext(personId: string | null): Promise<string> {
  const orgSettings = await getOrgSettings();
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // still relevant a couple days after it starts

  const [ownEventIds, upcoming] = await Promise.all([
    personId
      ? db.registration.findMany({ where: { personId }, select: { eventId: true } }).then((rows) => new Set(rows.map((r) => r.eventId)))
      : Promise.resolve(new Set<string>()),
    db.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: recentCutoff } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { ticketTypes: true },
    }),
  ]);

  if (upcoming.length === 0) return "No hay eventos próximos publicados en este momento.";

  const blocks = upcoming.map((ev) => {
    const when = formatDateInTz(ev.startsAt, { dateStyle: "full", timeStyle: "short" }, orgSettings.timezone, orgSettings.language);
    const ticketLines = ev.ticketTypes.length
      ? ev.ticketTypes.map((t) => `  - ${t.name}: ${t.price === 0 ? "GRATIS" : `$${t.price}`}`).join("\n")
      : "  - Entrada general: GRATIS";
    return [
      `Evento: ${ev.name}${ownEventIds.has(ev.id) ? " (esta persona YA está inscrita a este evento)" : ""}`,
      `Ciudad: ${ev.city}`,
      `Cuándo: ${when}`,
      ev.venueName ? `Lugar: ${ev.venueName}` : null,
      ev.venueAddress ? `Dirección: ${ev.venueAddress}` : null,
      `Entradas:\n${ticketLines}`,
      ev.description ? `Descripción:\n${stripHtml(ev.description)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return blocks.join("\n\n---\n\n");
}

interface TimelineForModel {
  role: "user" | "assistant";
  text: string;
}

async function buildConversationHistory(conversationId: string): Promise<TimelineForModel[]> {
  const messages = await db.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MESSAGE_LIMIT,
  });
  return messages
    .reverse()
    .filter((m) => m.body)
    .map((m) => ({ role: m.direction === "INBOUND" ? ("user" as const) : ("assistant" as const), text: m.body! }));
}

/** The Bandeja auto-reply agent — see WhatsAppConversation.
 * aiAutoReplyEnabled's own comment for the on/off model, and the CLAUDE.md
 * conversation this was scoped from: answers real questions about the
 * event using ONLY get_event_info's data (never invented), can resend a
 * confirmed ticket's PDF (reuses the exact same send path the Bandeja
 * "Reenviar PDF por WhatsApp" button uses), and hands off to a human the
 * moment the customer asks for one — nothing beyond that scope (no
 * chat-based registration, no anything that writes new Person/
 * Registration data) is in the agent's tool surface.
 *
 * Called from lib/whatsapp/inbox.ts right after a real inbound message is
 * logged. Never throws past this module — a failure here must never break
 * the webhook's own 200 response to Meta or leave the inbound message
 * unlogged; the caller wraps this in its own try/catch as a second layer,
 * but every awaited step in here is already defensive on its own terms
 * (missing API key, no connection, provider error all resolve to "do
 * nothing", not an unhandled rejection).
 */
export async function respondWithAi(conversationId: string): Promise<void> {
  const client = getAnthropicClient();
  if (!client) {
    console.error("whatsapp ai agent: ANTHROPIC_API_KEY not configured — skipping auto-reply for", conversationId);
    return;
  }

  const conversation = await db.whatsAppConversation.findUnique({
    where: { id: conversationId },
    include: { person: true },
  });
  if (!conversation || !conversation.aiAutoReplyEnabled) return;

  const withinWindow = Boolean(conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS);
  if (!withinWindow) return; // same 24h rule a human reply is held to — see WhatsAppReplyBox's own comment

  const [orgSettings, eventContext, history] = await Promise.all([
    getOrgSettings(),
    buildEventContext(conversation.personId),
    buildConversationHistory(conversationId),
  ]);

  const customerName = conversation.person
    ? [conversation.person.firstName, conversation.person.lastName].filter(Boolean).join(" ").trim()
    : null;

  const resendTicketPdfTool = betaZodTool({
    name: "resend_ticket_pdf",
    description:
      "Reenvía por WhatsApp el PDF de la entrada (con el código QR) de una inscripción confirmada de esta persona. Úsalo cuando diga que no le llegó el correo de confirmación o pida su entrada de nuevo. Si la persona tiene más de una inscripción, este tool te devuelve la lista para que le preguntes cuál — no adivines.",
    inputSchema: z.object({
      eventId: z
        .string()
        .optional()
        .describe("El id del evento cuya entrada reenviar — solo hace falta si la persona tiene más de una inscripción y ya sabes cuál quiere."),
    }),
    run: async (input) => {
      if (!conversation.personId) {
        return "Esta conversación no está vinculada a ningún contacto del CRM — no hay ninguna entrada que reenviar. Dile que verifique el número con el que se inscribió.";
      }
      const registrations = await listResendableRegistrations(conversation.personId);
      if (registrations.length === 0) {
        return "Esta persona no tiene ninguna inscripción confirmada — no hay ninguna entrada que reenviar.";
      }
      const target = input.eventId ? registrations.find((r) => r.eventId === input.eventId) : registrations[0];
      if (!target) {
        return "No encontré esa inscripción específica.";
      }
      if (!input.eventId && registrations.length > 1) {
        return `Esta persona tiene ${registrations.length} inscripciones: ${registrations
          .map((r) => `"${r.event.name}" (eventId: ${r.eventId})`)
          .join(", ")}. Pregúntale cuál quiere antes de reenviar, y vuelve a llamar este tool con el eventId correcto.`;
      }
      const result = await sendTicketPdfViaWhatsApp(target.id, conversation.phone);
      return result.ok
        ? `Listo — se envió el PDF de la entrada para "${target.event.name}" por este mismo WhatsApp.`
        : `No se pudo enviar el PDF (${result.error}). Dile a la persona que un asesor se lo va a mandar en un momento, y considera usar escalate_to_human.`;
    },
  });

  const escalateToHumanTool = betaZodTool({
    name: "escalate_to_human",
    description:
      "Marca esta conversación para que un miembro real del equipo la atienda, y deja de responder automáticamente en este hilo. Úsalo SIEMPRE que la persona pida explícitamente hablar con alguien, con un asesor, con una persona real, etc. — o cuando la pregunta esté claramente fuera de lo que puedes resolver (quejas serias, algo que no está en la información del evento, algo que suene a una situación delicada).",
    inputSchema: z.object({
      reason: z.string().describe("Una frase corta explicando por qué se escaló, para que el equipo la vea en la nota interna."),
    }),
    run: async (input) => {
      await db.whatsAppConversation.update({ where: { id: conversationId }, data: { aiAutoReplyEnabled: false } });
      await addNote(conversationId, null, `🤖 Agente IA escaló a un humano — ${input.reason}`);
      return "Listo, un miembro del equipo va a seguir la conversación. Despídete brevemente y avísale que ya alguien la va a atender.";
    },
  });

  const systemPrompt = [
    `Eres el asistente de WhatsApp de ${orgSettings.name}, una feria/evento de la industria de uñas en Colombia. Respondes en el WhatsApp real del negocio a clientes reales.`,
    "",
    "REGLAS ESTRICTAS:",
    "- Nunca inventes fechas, precios, direcciones ni ningún dato del evento — toda esa información real está en el bloque 'INFORMACIÓN REAL DE EVENTOS' de abajo. Si no está ahí, dilo con honestidad y ofrece escalar con escalate_to_human.",
    "- Nunca digas que enviaste algo (como la entrada en PDF) a menos que el resultado del tool resend_ticket_pdf te confirme que sí se envió.",
    "- Si la persona pide hablar con un humano/asesor/persona real, o la situación se sale de lo que puedes resolver, usa escalate_to_human de inmediato — no sigas intentando resolverlo solo.",
    "- Escribe como se escribe por WhatsApp: mensajes cortos (1-4 líneas), tono cálido y cercano, colombiano, nunca corporativo ni robótico. Usa emojis con moderación, como los que ya usa la marca (✨💗📍🕐), nunca en exceso.",
    "- Nunca uses markdown (nada de **negrita** con doble asterisco, nada de encabezados con #). Si necesitas resaltar algo, usa *un solo asterisco* como hace WhatsApp de verdad.",
    "- No niegues ser un asistente/IA si preguntan directamente, pero tampoco lo menciones sin que pregunten — la idea es que se sienta como una conversación normal y útil, no un anuncio de que hay un bot.",
    customerName ? `- El nombre de esta persona en el CRM es "${customerName}" — puedes usarlo con naturalidad.` : "",
    "",
    "INFORMACIÓN REAL DE EVENTOS:",
    eventContext,
  ]
    .filter(Boolean)
    .join("\n");

  // No explicit BetaMessageParam[] annotation — structural typing already
  // matches what toolRunner expects, and it saves pinning down this SDK's
  // exact (non-obvious, deeply-nested) exported type path for a beta
  // namespace. Same reasoning below for the tool-runner's return value
  // and the text-block lookup — inference over guessed type paths.
  const messages = history.map((h) => ({ role: h.role, content: h.text }));
  if (messages.length === 0 || messages[messages.length - 1]!.role !== "user") {
    // Defensive fallback — should never happen since this only runs right
    // after a real inbound message was just logged, but never send an
    // agent request with no user turn at all.
    return;
  }

  let finalMessage: Awaited<ReturnType<typeof client.beta.messages.toolRunner>>;
  try {
    finalMessage = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      // Real-time customer chat answering FAQs + one simple tool call —
      // not a hard reasoning task, so low effort keeps replies fast and
      // cheap without hurting quality here (see the claude-api skill's
      // own cost-tuning guidance for this workload shape).
      output_config: { effort: "low" },
      tools: [resendTicketPdfTool, escalateToHumanTool],
      messages,
    });
  } catch (err) {
    console.error("whatsapp ai agent: Claude request failed", conversationId, err);
    return;
  }

  const textBlock = finalMessage.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
  const replyText = textBlock?.text?.trim();
  if (!replyText) return; // model ended the turn with only tool calls and no text — nothing to send

  try {
    const result = await whatsappProvider.sendFreeform({ to: conversation.phone, text: replyText });
    await recordOutboundMessage({
      phone: conversation.phone,
      kind: "FREEFORM",
      body: replyText,
      providerMessageId: result.providerMessageId,
      status: "SENT",
      generatedByAi: true,
    });
  } catch (err) {
    await recordOutboundMessage({
      phone: conversation.phone,
      kind: "FREEFORM",
      body: replyText,
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
      generatedByAi: true,
    });
    console.error("whatsapp ai agent: send failed", conversationId, err);
  }
}

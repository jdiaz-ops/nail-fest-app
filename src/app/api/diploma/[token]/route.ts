import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { confirmationCodeFor } from "@/lib/ticket";
import { renderDiplomaPdf } from "@/lib/imparables/diploma";
import { diplomaDataOf, diplomaName, SAMPLE_DIPLOMA } from "@/lib/imparables/diplomaText";
import { congressTimes, dayWords, readRecordings } from "@/lib/imparables/grabaciones";
import { findCongreso } from "@/lib/imparables/miCongreso";

export const dynamic = "force-dynamic";

// Her diploma of Manicuristas Imparables (lib/imparables/diploma.ts) — a link of its own, for the emails (the team,
// 2026-11-04: «el diploma es independiente»): her name on it, her ticket's code as its number. Only once her payment
// is confirmed and the congress is over; before that, or without her name, or for a link we didn't make, a short page
// says so in the congress's colors. The team's sample token draws the sample's, at any time. ?descargar saves it
// instead of opening it.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function notice(status: number, title: string, text: string, help?: string | null) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:#ede8e1;color:#141414;font-family:Manrope,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;">
<p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#6e5230;">Manicuristas Imparables</p>
<h1 style="margin:14px 0 0;font-family:Cinzel,Georgia,serif;font-size:28px;line-height:1.15;">${esc(title)}</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#5e564c;">${esc(text)}</p>
${help ? `<p style="margin:22px 0 0;"><a href="${esc(help)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#c9a46a;color:#141414;font-weight:800;text-decoration:none;">Escríbenos por WhatsApp</a></p>` : ""}
</main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

async function helpUrl(): Promise<string | null> {
  const whatsapp = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } });
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const access = await findCongreso(params.token);
  if (!access || (access.kind === "buyer" && access.waiting)) {
    return notice(404, "Este enlace no abre ningún diploma", "Revisa que esté completo, tal como te llegó. Si sigue sin abrir, escríbenos.", await helpUrl());
  }
  const { timezone } = await getOrgSettings();

  let data;
  if (access.kind === "sample") {
    data = diplomaDataOf(access.event, SAMPLE_DIPLOMA.name, SAMPLE_DIPLOMA.code, timezone);
  } else {
    const times = congressTimes(access.event, readRecordings(access.event.recordings), timezone);
    if (Date.now() < times.ends.getTime()) {
      return notice(403, "Tu diploma todavía no está listo", `Se activa al terminar el congreso, el ${dayWords(times.lastDay)}. Vuelve a abrir este enlace entonces.`);
    }
    const name = diplomaName(access.registration.person.firstName, access.registration.person.lastName);
    if (!name) return notice(404, "Nos falta tu nombre", "No tenemos tu nombre completo para el diploma. Escríbenos y te lo hacemos.", await helpUrl());
    data = diplomaDataOf(access.event, name, confirmationCodeFor(access.registration.id), timezone);
  }

  const pdf = await renderDiplomaPdf(data);
  const slug = data.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const disposition = req.nextUrl.searchParams.has("descargar") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="diploma-imparables${slug ? `-${slug}` : ""}.pdf"`,
      // Hers alone, and drawn from the event as it is now.
      "Cache-Control": "private, no-store",
    },
  });
}

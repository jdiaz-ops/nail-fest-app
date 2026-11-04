import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { sayName } from "@/lib/mesa/email";
import { reviewUrl } from "@/lib/reviews";
import { sponsorLogosOf } from "./blocks";
import { closingSubject, imparablesClosingEmail, type ImparablesClosing } from "./closingEmail";
import { congressTimes, dayWords, readRecordings } from "./grabaciones";
import { congresoSamplePath, congresoSampleToken, congresoUrl, diplomaPath, diplomaUrl } from "./miCongreso";
import { coverName, eventWhen } from "./schedule";

// The closing email's data (closingEmail.ts): the event's part — its name, its day, how long its recordings last, the
// team's WhatsApp — and each buyer's own links. The team's sample (Laura) opens the event's sample pages; nothing here
// sends anything.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

async function closingOf(event: Event, her: { firstName: string; recordings: string; diploma: string | null; review: string | null }): Promise<ImparablesClosing> {
  const [orgSettings, whatsapp] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const base = baseUrl();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  const times = congressTimes(event, readRecordings(event.recordings), orgSettings.timezone);
  return {
    firstName: her.firstName,
    eventName: coverName(publicEventName(event)),
    date: eventWhen(event, orgSettings.timezone).dates,
    recordings: { url: her.recordings, until: dayWords(times.recordingsUntil) },
    diploma: her.diploma ? { url: her.diploma } : null,
    review: her.review ? { url: her.review } : null,
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    // The brands under «Con el apoyo de», as the cover reads them: from their section even while it's hidden.
    sponsors: sponsorLogosOf(parseLandingBlocks(event.landingBlocks))
      .slice(0, 4)
      .map((item) => ({ name: item.handle.trim(), url: new URL(item.url.trim(), `${base}/`).toString() })),
    images: { header: `${base}/imparables/correo-cabecera.png`, logo: `${base}/logo.png` },
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** The team's sample: «Laura», and the event's sample recordings page, diploma and review page. */
export async function imparablesClosingSample(event: Event): Promise<{ subject: string; html: string; text: string }> {
  const base = baseUrl();
  return imparablesClosingEmail(
    await closingOf(event, {
      firstName: "Laura",
      recordings: `${base}${congresoSamplePath(event.id)}`,
      diploma: `${base}${diplomaPath(congresoSampleToken(event.id))}?descargar`,
      review: `${base}/resena/${congresoSampleToken(event.id)}`,
    })
  );
}

/** Hers, for a confirmed purchase of Manicuristas Imparables; null for anything else. */
export async function imparablesClosingFor(registrationId: string): Promise<{ subject: string; html: string; text: string } | null> {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { event: true, person: true } });
  if (!registration || registration.status !== "CONFIRMED" || registration.event.theme !== "IMPARABLES") return null;
  return imparablesClosingEmail(
    await closingOf(registration.event, {
      firstName: sayName(registration.person.firstName),
      recordings: congresoUrl(registration.id),
      diploma: diplomaUrl(registration.id),
      review: registration.qrToken ? reviewUrl(registration.qrToken) : null,
    })
  );
}

export { closingSubject };

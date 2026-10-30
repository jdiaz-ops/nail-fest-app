import type { Event, LandingVersion } from "@prisma/client";
import { db } from "@/lib/db";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { getOrgSettings } from "@/lib/settings";
import type { VersionDraft } from "@/components/VersionEditor";
import { getActiveStage } from "./pricing";
import { specialPricesOf } from "./versions";

// What the version editor's pages hand it (2026-10-30): the event's stages,
// the version as the form shows it (its dates in the account's time zone),
// the site's address for its links, and what the special price doesn't
// count toward.
export async function versionEditorProps(event: Event, version: LandingVersion | null) {
  const [orgSettings, types, sales] = await Promise.all([
    getOrgSettings(),
    db.ticketType.findMany({ where: { eventId: event.id, status: "ON_SALE" }, orderBy: { order: "asc" }, select: { id: true, name: true, price: true } }),
    getActiveStage(event),
  ]);
  const local = (d: Date | null) => (d ? utcToZonedInputValue(d, orgSettings.timezone) : "");
  const initial: VersionDraft = version
    ? {
        id: version.id,
        name: version.name,
        slug: version.slug,
        enabled: version.enabled,
        startsAt: local(version.startsAt),
        endsAt: local(version.endsAt),
        title: version.title ?? "",
        subtitle: version.subtitle ?? "",
        imageUrl: version.imageUrl ?? "",
        buttonLabel: version.buttonLabel ?? "",
        specialPrices: specialPricesOf(version),
        priceLabel: version.priceLabel ?? "",
        maxSpecialSales: version.maxSpecialSales,
      }
    : { id: null, name: "", slug: "", enabled: true, startsAt: "", endsAt: "", title: "", subtitle: "", imageUrl: "", buttonLabel: "", specialPrices: {}, priceLabel: "", maxSpecialSales: null };
  const current = sales.current;
  return {
    eventId: event.id,
    initial,
    stages: types.filter((t) => t.price > 0),
    baseUrl: (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, ""),
    mainCapNote: current?.cap ? `No cuentan en los ${current.cap} cupos de la ${current.name}.` : "No cuentan en los cupos de su etapa.",
  };
}

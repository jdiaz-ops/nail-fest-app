import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { zonedTimeToUtc } from "@/lib/dateFormat";
import { getOrgSettings } from "@/lib/settings";
import { validVersionSlug } from "./versions";

// What the version editor saves (2026-10-30, «Versiones de la landing»):
// checked here — its link free and well written, its special prices below
// each stage's own, its end after its start — with its dates as the team
// writes them, in the account's time zone.

export const versionSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre.").max(120),
  slug: z.string().trim().toLowerCase().max(60),
  enabled: z.boolean(),
  /** «2026-11-14T08:00», in the account's time zone. */
  startsAt: z.string().nullish(),
  endsAt: z.string().nullish(),
  title: z.string().max(160).nullish(),
  subtitle: z.string().max(400).nullish(),
  imageUrl: z.string().max(1000).nullish(),
  buttonLabel: z.string().max(60).nullish(),
  /** Whole pesos by ticket type. */
  specialPrices: z.record(z.number().int().positive()).nullish(),
  priceLabel: z.string().max(60).nullish(),
  maxSpecialSales: z.number().int().positive().nullish(),
});

export type VersionInput = z.infer<typeof versionSchema>;

const clean = (s: string | null | undefined) => s?.trim() || null;

/** Saves it — new without an id — and returns its id, or what's wrong in words for the team. */
export async function saveVersion(eventId: string, id: string | null, input: VersionInput): Promise<{ id: string } | { problem: string }> {
  if (!validVersionSlug(input.slug)) return { problem: "El enlace solo puede tener letras minúsculas, números y guiones (de 2 a 60)." };
  const { timezone } = await getOrgSettings();
  const at = (value: string | null | undefined) => {
    if (!value?.trim()) return null;
    const date = zonedTimeToUtc(value, timezone);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const startsAt = at(input.startsAt);
  const endsAt = at(input.endsAt);
  if (startsAt === undefined || endsAt === undefined) return { problem: "Revisa las fechas de la vigencia." };
  if (startsAt && endsAt && endsAt <= startsAt) return { problem: "La vigencia termina antes de empezar." };

  const prices = input.specialPrices ?? {};
  const types = await db.ticketType.findMany({ where: { eventId }, select: { id: true, name: true, price: true } });
  for (const [typeId, price] of Object.entries(prices)) {
    const type = types.find((t) => t.id === typeId);
    if (!type) return { problem: "Una de las etapas ya no existe: recarga la página." };
    if (price >= type.price) return { problem: `El precio especial de ${type.name} tiene que ser menor que su precio normal.` };
  }
  const imageUrl = clean(input.imageUrl);
  if (imageUrl && !/^(https:\/\/|\/)/.test(imageUrl)) return { problem: "La foto de portada tiene que ser un enlace que empiece por https://." };

  const data = {
    name: input.name.trim(),
    slug: input.slug,
    enabled: input.enabled,
    startsAt,
    endsAt,
    title: clean(input.title),
    subtitle: clean(input.subtitle),
    imageUrl,
    buttonLabel: clean(input.buttonLabel),
    specialPrices: Object.keys(prices).length ? (prices as Prisma.InputJsonValue) : Prisma.DbNull,
    priceLabel: clean(input.priceLabel),
    maxSpecialSales: input.maxSpecialSales ?? null,
  };
  try {
    if (id) {
      await db.landingVersion.update({ where: { id }, data });
      return { id };
    }
    const created = await db.landingVersion.create({ data: { ...data, eventId }, select: { id: true } });
    return { id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { problem: "Ese enlace ya lo usa otra versión: elige otro." };
    throw err;
  }
}

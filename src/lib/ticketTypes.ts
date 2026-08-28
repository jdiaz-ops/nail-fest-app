import { db } from "@/lib/db";
import { z } from "zod";
import type { TicketType, TicketTypeStatus, TicketIssuance } from "@prisma/client";

// Shared by both ticket-type API routes (create + update) — lives here,
// not in either route.ts, because Next.js App Router route files may
// only export the HTTP method handlers and a small fixed set of special
// names; any other export (this schema, previously) fails the build.
export const ticketTypeBodySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().int().min(0).default(0),
  bookingFee: z.number().int().min(0).default(0),
  description: z.string().default(""),
  status: z.enum(["ON_SALE", "HIDDEN", "ACCESS_CODE_REQUIRED", "SOLD_OUT", "UNAVAILABLE", "ADMIN_ONLY"]).default("ON_SALE"),
  minPerOrder: z.number().int().min(1).default(1),
  maxPerOrder: z.number().int().min(1).default(20),
  issuance: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
  hideUntil: z.string().nullable().optional(),
  hideAfter: z.string().nullable().optional(),
  hideWhenSoldOut: z.boolean().default(false),
  showRemainingOnPage: z.boolean().default(false),
  excludeFromLowestPrice: z.boolean().default(false),
});

export interface TicketTypeInput {
  name: string;
  quantity: number;
  price: number;
  bookingFee: number;
  description: string;
  status: TicketTypeStatus;
  minPerOrder: number;
  maxPerOrder: number;
  issuance: TicketIssuance;
  hideUntil: Date | null;
  hideAfter: Date | null;
  hideWhenSoldOut: boolean;
  showRemainingOnPage: boolean;
  excludeFromLowestPrice: boolean;
}

export async function listTicketTypes(eventId: string): Promise<TicketType[]> {
  return db.ticketType.findMany({ where: { eventId }, orderBy: { order: "asc" } });
}

export async function createTicketType(eventId: string, input: TicketTypeInput): Promise<TicketType> {
  const maxOrder = await db.ticketType.aggregate({ where: { eventId }, _max: { order: true } });
  return db.ticketType.create({
    data: {
      eventId,
      name: input.name,
      quantity: input.quantity,
      price: input.price,
      bookingFee: input.bookingFee,
      description: input.description || null,
      status: input.status,
      minPerOrder: input.minPerOrder,
      maxPerOrder: input.maxPerOrder,
      issuance: input.issuance,
      hideUntil: input.hideUntil,
      hideAfter: input.hideAfter,
      hideWhenSoldOut: input.hideWhenSoldOut,
      showRemainingOnPage: input.showRemainingOnPage,
      excludeFromLowestPrice: input.excludeFromLowestPrice,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateTicketType(id: string, input: TicketTypeInput): Promise<TicketType> {
  return db.ticketType.update({
    where: { id },
    data: {
      name: input.name,
      quantity: input.quantity,
      price: input.price,
      bookingFee: input.bookingFee,
      description: input.description || null,
      status: input.status,
      minPerOrder: input.minPerOrder,
      maxPerOrder: input.maxPerOrder,
      issuance: input.issuance,
      hideUntil: input.hideUntil,
      hideAfter: input.hideAfter,
      hideWhenSoldOut: input.hideWhenSoldOut,
      showRemainingOnPage: input.showRemainingOnPage,
      excludeFromLowestPrice: input.excludeFromLowestPrice,
    },
  });
}

export async function deleteTicketType(id: string): Promise<void> {
  await db.ticketType.delete({ where: { id } });
}

export interface PublicTicketType {
  id: string;
  name: string;
  price: number;
  minPerOrder: number;
  maxPerOrder: number;
  remaining: number;
  showRemainingOnPage: boolean;
}

// What the public "Entradas" step (EventRegistration.tsx) actually shows —
// only ON_SALE types, respecting hideUntil/hideAfter, with real remaining
// availability computed from actual registrations (quantity minus the sum
// of ticketCount across every non-cancelled registration under that
// type), not the raw quantity. HIDDEN/ACCESS_CODE_REQUIRED/SOLD_OUT/
// UNAVAILABLE/ADMIN_ONLY statuses are deliberately not returned here —
// gating by those (an access-code prompt, an admin preview mode) is real
// scope beyond "show what's on sale", not built yet.
export async function getPublicTicketTypes(eventId: string, now: Date = new Date()): Promise<PublicTicketType[]> {
  const types = await db.ticketType.findMany({ where: { eventId, status: "ON_SALE" }, orderBy: { order: "asc" } });
  const visible = types.filter((t) => {
    if (t.hideUntil && now < t.hideUntil) return false;
    if (t.hideAfter && now > t.hideAfter) return false;
    return true;
  });
  if (visible.length === 0) return [];

  const sold = await db.registration.groupBy({
    by: ["ticketTypeId"],
    where: { ticketTypeId: { in: visible.map((t) => t.id) }, status: { not: "CANCELLED" } },
    _sum: { ticketCount: true },
  });
  const soldByType = new Map(sold.map((s) => [s.ticketTypeId, s._sum.ticketCount ?? 0]));

  return visible
    .map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      minPerOrder: t.minPerOrder,
      maxPerOrder: t.maxPerOrder,
      remaining: Math.max(0, t.quantity - (soldByType.get(t.id) ?? 0)),
      showRemainingOnPage: t.showRemainingOnPage,
    }))
    .filter((t) => t.remaining > 0 || !types.find((raw) => raw.id === t.id)?.hideWhenSoldOut);
}

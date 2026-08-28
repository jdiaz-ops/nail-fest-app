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

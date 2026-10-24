import { z } from "zod";

// What the library's and the instructors' forms send (POST
// /api/library/leads): the free sign-up, an instructor's application, a
// brand looking for instructors and a class booking.

export const LIBRARY_LEAD_KINDS = ["REGISTRO", "POSTULACION", "MARCA", "CLASE"] as const;
export type LibraryLeadKindKey = (typeof LIBRARY_LEAD_KINDS)[number];

/** The forms the pages still offer (2026-10-25: no brand requests — that's
 * Marcolini's — and no class bookings through Nail Fest: each instructor
 * takes her own; 2026-10-24: instructors make their own profile in the
 * portal instead of applying). POSTULACION, MARCA and CLASE stay only for
 * what already came in. */
export const PUBLIC_LEAD_KINDS: readonly LibraryLeadKindKey[] = ["REGISTRO"];

export const LEAD_KIND_LABELS: Record<LibraryLeadKindKey, string> = {
  REGISTRO: "Registro gratis",
  POSTULACION: "Postulación de instructora",
  MARCA: "Marca que busca instructoras",
  CLASE: "Reserva de clase",
};

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const leadSchema = z
  .object({
    kind: z.enum(LIBRARY_LEAD_KINDS),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    phone: optionalText(40),
    city: optionalText(80),
    company: optionalText(120),
    message: optionalText(1500),
    /** The instructor's slug (CLASE, or MARCA from her profile). */
    instructor: optionalText(120),
    context: optionalText(200),
    marketingConsent: z.boolean().default(false),
    /** A field people never see: a bot fills it in. */
    website: z.string().max(300).optional(),
  })
  .superRefine((lead, ctx) => {
    if (lead.kind !== "REGISTRO" && !lead.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "required" });
    if (lead.kind === "MARCA" && !lead.company) ctx.addIssue({ code: "custom", path: ["company"], message: "required" });
    if (lead.kind === "POSTULACION" && !lead.city) ctx.addIssue({ code: "custom", path: ["city"], message: "required" });
  });

export type LeadInput = z.infer<typeof leadSchema>;

import { z } from "zod";
import { LIBRARY_LEVELS, LIBRARY_THEMES, RESERVED_INSTRUCTOR_SLUGS, SAMPLE_SLUG_PREFIX, handleOf, youtubeIdFrom } from "./shared";

// The instructors' portal (nailfest.lat/instructoras/portal, 2026-10-24):
// each instructor makes her own profile with a username and a password,
// the team approves it before it shows in the directory, and she can send
// her videos for the library. No classes on the profile, and nothing is
// ever emailed to her for now — the team reaches her by WhatsApp. No
// database here: the portal's forms import it too.

/** The specialties she picks from — the directory's filter uses them. */
export const INSTRUCTOR_SPECIALTIES = [
  "Polygel",
  "Acrílico",
  "Semipermanente",
  "Nail art",
  "Manicura rusa",
  "Esculpidas",
  "Pedicura",
  "Spa de manos",
  "Bioseguridad",
  "Negocio de uñas",
] as const;

export const SPECIALTIES_UP_TO = 5;
export const BIO_UP_TO = 300;
export const PASSWORD_FROM = 8;

/** The onboarding, one step per screen. */
export const ONBOARDING_STEPS = ["Foto y nombre", "Ciudad y especialidades", "Sobre ti", "Redes y contacto", "Revisar y enviar"] as const;

// ── Username: her profile's address (nailfest.lat/instructoras/<usuario>) ──

const USERNAME = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Lowercase, without accents or spaces: "Ana Pérez" → "anaperez". */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
}

/** Why a username can't be used, in words; null when it can (it may still be taken). */
export function usernameProblem(username: string): string | null {
  if (username.length < 3) return "Usa al menos 3 letras o números.";
  if (username.length > 30) return "Usa hasta 30 letras o números.";
  if (!USERNAME.test(username)) return "Solo letras, números y guiones (sin empezar ni terminar en guion).";
  if (RESERVED_INSTRUCTOR_SLUGS.includes(username) || username.startsWith(SAMPLE_SLUG_PREFIX)) return "Ese usuario no está disponible.";
  return null;
}

// ── Phones and channels ─────────────────────────────────────────────────────

/** "300 000 0000", "+57 300…" or "57300…" → "+573000000000"; null when it isn't a phone. */
export function phoneOf(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (/^3\d{9}$/.test(digits)) return `+57${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (/^57\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/** "@ana.unas", "youtube.com/@ana.unas" or "youtube.com/channel/UC…" → "@ana.unas" or "channel/UC…". */
export function youtubeChannelOf(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.|m\.)?youtube\.com\//i, "")
    .split(/[?#]/)[0]!
    .replace(/\/+$/, "");
  if (/^@[A-Za-z0-9._-]{3,40}$/.test(text)) return text;
  if (/^[A-Za-z0-9._-]{3,40}$/.test(text)) return `@${text}`;
  if (/^(?:channel\/UC[A-Za-z0-9_-]{10,40}|c\/[A-Za-z0-9._-]{2,60})$/.test(text)) return text;
  return null;
}

export function youtubeChannelUrl(channel: string): string {
  return `https://www.youtube.com/${channel}`;
}

export function whatsappUrl(phone: string, text?: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// ── What the portal's forms send ────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

/** A field that's cleared with "" and left alone when it isn't sent. */
const normalized = (normalize: (v: string) => string | null, message: string) =>
  z
    .string()
    .max(200)
    .nullish()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const value = normalize(v);
      if (!value) ctx.addIssue({ code: "custom", message });
      return value;
    });

export const signupSchema = z.object({
  username: z.string().max(60).transform(normalizeUsername),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z
    .string()
    .max(40)
    .transform((v, ctx) => {
      const phone = phoneOf(v);
      if (!phone) ctx.addIssue({ code: "custom", message: "phone" });
      return phone ?? "";
    }),
  password: z.string().min(PASSWORD_FROM).max(200),
  acceptTerms: z.literal(true),
  // The honeypot: people never fill it in.
  website: z.string().max(200).optional(),
});

/** Her profile, all of it or one step of the onboarding at a time. */
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(60),
    online: z.boolean(),
    photoUrl: z.string().url().max(600).startsWith("https://").nullable(),
    bio: optionalText(BIO_UP_TO),
    specialties: z.array(z.string().trim().min(1).max(40)).max(SPECIALTIES_UP_TO),
    instagram: normalized(handleOf, "instagram"),
    tiktok: normalized(handleOf, "tiktok"),
    youtube: normalized(youtubeChannelOf, "youtube"),
    whatsapp: normalized(phoneOf, "whatsapp"),
    paused: z.boolean(),
  })
  .partial();

export type ProfileInput = z.infer<typeof profileSchema>;

const themeKeys = LIBRARY_THEMES.map((t) => t.key) as [string, ...string[]];
const levelKeys = LIBRARY_LEVELS.map((l) => l.key) as [string, ...string[]];

/** "Enviar un video": her own YouTube link and its ficha. */
export const submissionSchema = z.object({
  youtube: z
    .string()
    .max(300)
    .transform((v, ctx) => {
      const id = youtubeIdFrom(v);
      if (!id) ctx.addIssue({ code: "custom", message: "youtube" });
      return id ?? "";
    }),
  title: z.string().trim().min(3).max(140),
  theme: z.enum(themeKeys),
  level: z.enum(levelKeys),
  description: optionalText(1000),
  /** One product per line. */
  products: z
    .string()
    .max(3000)
    .default("")
    .transform((v) =>
      v
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  /** The content permission — required with her first video. */
  acceptContent: z.boolean().default(false),
});

// ── The profile's boxes ─────────────────────────────────────────────────────

/** Her profile as the portal's boxes show it ("" for what she hasn't filled in). */
export interface PortalProfileValues {
  name: string;
  city: string;
  online: boolean;
  photoUrl: string | null;
  bio: string;
  specialties: string[];
  instagram: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
}

export function profileValuesOf(i: PortalProfileFacts & { slug: string; online: boolean; whatsapp: string | null }): PortalProfileValues {
  return {
    // A new account starts with her username as its name: hers to replace.
    name: i.name === i.slug ? "" : i.name,
    city: i.city,
    online: i.online,
    photoUrl: i.photoUrl,
    bio: i.bio ?? "",
    specialties: i.specialties,
    instagram: i.instagram ?? "",
    tiktok: i.tiktok ?? "",
    youtube: i.youtube ?? "",
    whatsapp: i.whatsapp ?? "",
  };
}

// ── Where she stands ────────────────────────────────────────────────────────

export interface PortalProfileFacts {
  name: string;
  city: string;
  photoUrl: string | null;
  bio: string | null;
  specialties: string[];
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
}

/** What makes a profile complete, and what's still missing. */
export function profileCompleteness(p: PortalProfileFacts): { done: number; total: number; missing: string[] } {
  const items: [boolean, string][] = [
    [Boolean(p.photoUrl), "tu foto"],
    [p.name.trim().length >= 2 && p.city.trim().length >= 2, "tu nombre y tu ciudad"],
    [p.specialties.length > 0, "tus especialidades"],
    [Boolean(p.bio), "algo sobre ti"],
    [Boolean(p.instagram || p.tiktok || p.youtube), "tus redes"],
  ];
  return { done: items.filter(([ok]) => ok).length, total: items.length, missing: items.filter(([ok]) => !ok).map(([, label]) => label) };
}

/** Enough to send for review: a name, a city and at least one specialty. */
export function readyToSubmit(p: PortalProfileFacts): boolean {
  return p.name.trim().length >= 2 && p.city.trim().length >= 2 && p.specialties.length > 0;
}

export type ProfileStatus = "draft" | "review" | "live" | "paused" | "hidden";

/** Her profile as she sees it in the portal: still making it, waiting for
 * the team, in the directory, paused by her, or hidden by the team. */
export function profileStatus(i: { visible: boolean; paused: boolean; submittedAt: Date | string | null; approvedAt: Date | string | null }): ProfileStatus {
  if (!i.visible) return "hidden";
  if (!i.approvedAt) return i.submittedAt ? "review" : "draft";
  return i.paused ? "paused" : "live";
}

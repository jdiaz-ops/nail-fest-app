import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  phoneOf,
  profileCompleteness,
  profileSchema,
  profileStatus,
  profileValuesOf,
  readyToSubmit,
  signupSchema,
  submissionSchema,
  usernameProblem,
  whatsappUrl,
  youtubeChannelOf,
} from "./portal";
import { productRefOfLine } from "./admin";

const facts = {
  slug: "anaperez",
  name: "Ana Pérez",
  city: "Cúcuta",
  online: false,
  whatsapp: null,
  photoUrl: null,
  bio: null,
  specialties: ["Polygel"],
  instagram: null,
  tiktok: null,
  youtube: null,
};

describe("the username: her profile's address", () => {
  it("is written lowercase, without accents or spaces", () => {
    expect(normalizeUsername("  Ana Pérez ")).toBe("anaperez");
    expect(normalizeUsername("MARÍA-JOSÉ")).toBe("maria-jose");
  });

  it("says in words why one can't be used", () => {
    expect(usernameProblem("an")).toBe("Usa al menos 3 letras o números.");
    expect(usernameProblem("a".repeat(31))).toBe("Usa hasta 30 letras o números.");
    expect(usernameProblem("ana_perez")).toMatch(/Solo letras, números y guiones/);
    expect(usernameProblem("-ana")).toMatch(/Solo letras, números y guiones/);
    expect(usernameProblem("portal")).toBe("Ese usuario no está disponible.");
    expect(usernameProblem("unirme")).toBe("Ese usuario no está disponible.");
    expect(usernameProblem("ejemplo-ana")).toBe("Ese usuario no está disponible.");
    expect(usernameProblem("ana-perez")).toBeNull();
  });
});

describe("phones and channels", () => {
  it("reads a Colombian cell however it's typed, and others with their code", () => {
    expect(phoneOf("300 123 4567")).toBe("+573001234567");
    expect(phoneOf("573001234567")).toBe("+573001234567");
    expect(phoneOf("+52 55 1234 5678")).toBe("+525512345678");
    expect(phoneOf("12345")).toBeNull();
    expect(phoneOf("")).toBeNull();
  });

  it("keeps a YouTube channel as its handle or its channel path", () => {
    expect(youtubeChannelOf("https://www.youtube.com/@ana.unas")).toBe("@ana.unas");
    expect(youtubeChannelOf("@ana.unas")).toBe("@ana.unas");
    expect(youtubeChannelOf("ana.unas")).toBe("@ana.unas");
    expect(youtubeChannelOf("youtube.com/channel/UCabcdefghijklmnop12")).toBe("channel/UCabcdefghijklmnop12");
    expect(youtubeChannelOf("https://example.com/ana/videos")).toBeNull();
  });

  it("opens WhatsApp with the message written", () => {
    expect(whatsappUrl("+573001234567", "Hola, Ana")).toBe("https://wa.me/573001234567?text=Hola%2C%20Ana");
  });
});

describe("what the portal's forms send", () => {
  it("sign-up: the username, email and phone as they're stored", () => {
    const parsed = signupSchema.parse({ username: "Ana Pérez", email: " Ana@Correo.COM ", phone: "300 123 4567", password: "12345678", acceptTerms: true });
    expect(parsed).toMatchObject({ username: "anaperez", email: "ana@correo.com", phone: "+573001234567" });
  });

  it("sign-up: refused without the terms, with a short password or a bad phone", () => {
    const base = { username: "ana", email: "ana@correo.com", phone: "3001234567", password: "12345678", acceptTerms: true };
    expect(signupSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "1234567" }).success).toBe(false);
    const phone = signupSchema.safeParse({ ...base, phone: "123" });
    expect(phone.success).toBe(false);
    if (!phone.success) expect(phone.error.issues[0]?.path).toEqual(["phone"]);
  });

  it("profile: an emptied box clears it, a box not sent is left alone", () => {
    expect(profileSchema.parse({ instagram: "", bio: "  " })).toEqual({ instagram: null, bio: null });
    expect(profileSchema.parse({ instagram: "https://instagram.com/ana.unas/" })).toEqual({ instagram: "ana.unas" });
    expect(profileSchema.parse({ whatsapp: "300 123 4567", youtube: "youtube.com/@ana" })).toEqual({ whatsapp: "+573001234567", youtube: "@ana" });
    expect(profileSchema.parse({ name: "Ana" })).toEqual({ name: "Ana" });
  });

  it("profile: a channel or a phone that isn't one is refused, by its box", () => {
    const parsed = profileSchema.safeParse({ youtube: "https://example.com/ana/videos" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["youtube"]);
    expect(profileSchema.safeParse({ specialties: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
    expect(profileSchema.safeParse({ photoUrl: "http://not-https.example/x.jpg" }).success).toBe(false);
  });

  it("a video: her link as its id, one product per line", () => {
    const parsed = submissionSchema.parse({
      youtube: "https://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      title: "Francesa invertida",
      theme: "tecnicas",
      level: "intermedio",
      products: " Marca · Polygel natural 30 g \n\n Top coat ",
    });
    expect(parsed).toMatchObject({ youtube: "dQw4w9WgXcQ", products: ["Marca · Polygel natural 30 g", "Top coat"], acceptContent: false });
    expect(submissionSchema.safeParse({ youtube: "no es un enlace", title: "Francesa", theme: "tecnicas", level: "intermedio" }).success).toBe(false);
    expect(submissionSchema.safeParse({ youtube: "dQw4w9WgXcQ", title: "Francesa", theme: "otro", level: "intermedio" }).success).toBe(false);
  });
});

describe("where her profile stands", () => {
  const at = new Date("2026-10-24T12:00:00Z");
  it("draft, in review, live, paused by her or hidden by the team", () => {
    expect(profileStatus({ visible: true, paused: false, submittedAt: null, approvedAt: null })).toBe("draft");
    expect(profileStatus({ visible: true, paused: false, submittedAt: at, approvedAt: null })).toBe("review");
    expect(profileStatus({ visible: true, paused: false, submittedAt: at, approvedAt: at })).toBe("live");
    expect(profileStatus({ visible: true, paused: true, submittedAt: null, approvedAt: at })).toBe("paused");
    expect(profileStatus({ visible: false, paused: false, submittedAt: at, approvedAt: null })).toBe("hidden");
  });

  it("what's still missing, and when it can go to the team", () => {
    expect(profileCompleteness(facts)).toEqual({ done: 2, total: 5, missing: ["tu foto", "algo sobre ti", "tus redes"] });
    expect(profileCompleteness({ ...facts, photoUrl: "https://x.public.blob.vercel-storage.com/a.jpg", bio: "Hola", instagram: "ana" }).done).toBe(5);
    expect(readyToSubmit(facts)).toBe(true);
    expect(readyToSubmit({ ...facts, city: "" })).toBe(false);
    expect(readyToSubmit({ ...facts, specialties: [] })).toBe(false);
  });

  it("a new account's name — her username — shows as an empty box", () => {
    expect(profileValuesOf({ ...facts, name: "anaperez" }).name).toBe("");
    expect(profileValuesOf(facts)).toMatchObject({ name: "Ana Pérez", bio: "", instagram: "", whatsapp: "" });
  });
});

describe("a video she sent, made a library video", () => {
  it("turns each line of «Lo que usaste» into a line of «Lo que usó»", () => {
    expect(productRefOfLine("Marca · Polygel natural · 30 g")).toEqual({ cuponeraProductId: null, brand: "Marca", name: "Polygel natural · 30 g" });
    expect(productRefOfLine("Top coat sin limpieza")).toEqual({ cuponeraProductId: null, brand: "", name: "Top coat sin limpieza" });
  });
});

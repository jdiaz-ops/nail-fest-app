import { z } from "zod";

// What the admin API accepts for a list of landing blocks — shared by the
// event routes (Event.landingBlocks) and the info-page routes
// (InfoPage.blocks), so a block type added to the editor only has to be
// added here once. Parse-side twin of parseLandingBlocks in ./types.ts.
// The editor always sends the complete, current array (a full replace),
// never a partial patch.
export const landingBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), html: z.string() }),
  z.object({ type: z.literal("image"), url: z.string(), caption: z.string() }),
  z.object({ type: z.literal("video"), url: z.string(), caption: z.string(), autoplay: z.boolean() }),
  z.object({ type: z.literal("gallery"), images: z.array(z.string()) }),
  z.object({
    type: z.literal("faq"),
    title: z.string(),
    items: z.array(z.object({ question: z.string(), answer: z.string() })),
  }),
  z.object({ type: z.literal("heading"), title: z.string(), intro: z.string() }),
  z.object({
    type: z.literal("card"),
    eyebrow: z.string(),
    title: z.string(),
    html: z.string(),
    icon: z.enum(["none", "gift", "ticket", "star", "clock"]),
    tone: z.enum(["teal", "pink", "peach"]),
    imageUrl: z.string().default(""),
  }),
  z.object({
    type: z.literal("agenda"),
    rows: z.array(
      z.object({
        kind: z.enum(["session", "day"]).default("session"),
        chip: z.string(),
        topic: z.string().default(""),
        instructor: z.string().default(""),
        photoUrl: z.string().default(""),
        brand: z.string().default(""),
        brandLogoUrl: z.string().default(""),
        handles: z.string().default(""),
        sponsored: z.boolean().default(false),
        text: z.string().default(""),
        tone: z.enum(["teal", "pink", "peach"]),
      })
    ),
  }),
  z.object({ type: z.literal("venue"), imageUrl: z.string(), mapsUrl: z.string() }),
  z.object({
    type: z.literal("points"),
    items: z.array(z.object({ title: z.string(), text: z.string() })),
    tone: z.enum(["teal", "pink", "peach"]),
  }),
  z.object({
    type: z.literal("people"),
    items: z.array(
      z.object({ name: z.string(), handle: z.string(), tag: z.string(), photoUrl: z.string(), tone: z.enum(["teal", "pink", "peach"]) })
    ),
  }),
])
  // "Oculto" in the editor — see LandingBlock's own hidden flag.
  .and(z.object({ hidden: z.boolean().optional() }));

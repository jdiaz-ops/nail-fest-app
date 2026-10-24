import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLibrarySettings } from "@/lib/library/settings";
import { leadSchema } from "@/lib/library/leads";
import { LIBRARY_ACCESS_COOKIE, LIBRARY_ACCESS_MAX_AGE_SECONDS, libraryAccessToken } from "@/lib/library/access";
import { SAMPLE_SLUG_PREFIX } from "@/lib/library/shared";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";

// The library's and the instructors' forms (components/library/LeadForm).
// Saves what was sent for Editar biblioteca → Registros; the free sign-up
// also gets the cookie that opens the recordings and the step by steps. No
// email or WhatsApp goes out from here.

// The same address sending more than this in ten minutes is a script.
const MAX_PER_EMAIL = 5;
const WINDOW_MS = 10 * 60_000;

export async function POST(req: NextRequest) {
  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }
  const lead = parsed.data;
  // The box people never see came back filled in: a bot. It's told "ok".
  if (lead.website) return NextResponse.json({ ok: true });

  const [settings, staff] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples()]);
  const open = lead.kind === "REGISTRO" ? settings.published : settings.instructorsPublished;
  if (!open && !staff) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // An invented instructor (the staff preview): nothing to save.
  if (lead.instructor?.startsWith(SAMPLE_SLUG_PREFIX)) return NextResponse.json({ ok: true, sample: true });

  const recent = await db.libraryLead.count({ where: { email: lead.email, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } } });
  if (recent >= MAX_PER_EMAIL) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const instructor = lead.instructor
    ? await db.instructor.findUnique({ where: { slug: lead.instructor }, select: { id: true, visible: true } })
    : null;

  const saved = await db.libraryLead.create({
    data: {
      kind: lead.kind,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      company: lead.company,
      message: lead.message,
      instructorId: instructor?.visible ? instructor.id : null,
      context: lead.context,
      marketingConsent: lead.marketingConsent,
    },
  });

  const res = NextResponse.json({ ok: true });
  if (lead.kind === "REGISTRO") {
    res.cookies.set(LIBRARY_ACCESS_COOKIE, libraryAccessToken(saved.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: LIBRARY_ACCESS_MAX_AGE_SECONDS,
    });
  }
  return res;
}

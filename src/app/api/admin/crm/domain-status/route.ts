import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireUser } from "@/lib/auth/guard";

// The single most important pre-flight check before any real send — none
// of this app's own list hygiene (bounces, typos, disposable domains)
// matters if the SENDING domain itself was never authenticated. Without
// verified SPF/DKIM, mailbox providers have no way to trust that this
// domain is who it says it is, and even a perfectly clean list can land
// in spam. Reads Resend's own Domains API (resend.domains.list +
// .get(id) for the per-record SPF/DKIM breakdown) — verified against the
// installed SDK's own type definitions (node_modules/resend), not
// guessed. Only checks Resend; if EMAIL_PROVIDER is still "ses" (see
// lib/email/index.ts), domain verification lives in the AWS console
// instead — this route says so rather than guessing at an AWS API this
// app has no SDK for.
export async function POST(_req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, configured: false });
  }

  const resend = new Resend(apiKey);
  const list = await resend.domains.list();
  if (list.error || !list.data) {
    return NextResponse.json({ ok: false, error: list.error?.message ?? "No se pudo consultar Resend" }, { status: 502 });
  }

  const domains = await Promise.all(
    list.data.data.map(async (domain) => {
      const detail = await resend.domains.get(domain.id);
      const records = (detail.data?.records ?? []).map((r) => ({
        record: r.record,
        type: r.type,
        status: r.status,
      }));
      return { id: domain.id, name: domain.name, status: domain.status, records };
    })
  );

  return NextResponse.json({ ok: true, configured: true, domains });
}

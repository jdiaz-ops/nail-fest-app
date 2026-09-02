import { getOrgSettings } from "@/lib/settings";
import { getEnabledLinks } from "@/lib/linkPage";
import TrackedLink from "./TrackedLink";

export const dynamic = "force-dynamic";

const ALIGN_CSS: Record<"LEFT" | "CENTER" | "RIGHT", "left" | "center" | "right"> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
};

// nailfest.co/links — the public Linktree-equivalent, managed from
// /admin/links. Header reuses the EXACT homepage header (src/app/page.tsx:
// logo centered, tagline in the same small uppercase "elegant label"
// style below it), and the background (photo/GIF/video, OrgSettings.
// linksPageImageUrl) reuses the homepage's own hasMedia/gradient-scrim
// pattern — so the two pages read as one brand. Each link is a plain
// pill, its title's alignment set per-link (LinkPageLink.textAlign).
export default async function LinksPage() {
  const [orgSettings, links] = await Promise.all([getOrgSettings(), getEnabledLinks()]);
  const hasMedia = Boolean(orgSettings.linksPageVideoUrl || orgSettings.linksPageImageUrl);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: hasMedia ? "#0b2e2c" : "var(--accent-ink)",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px 64px",
      }}
    >
      {hasMedia && (
        <>
          {orgSettings.linksPageVideoUrl ? (
            <video
              src={orgSettings.linksPageVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- full-bleed page background from an admin-uploaded URL (photo or animated GIF)
            <img
              src={orgSettings.linksPageImageUrl!}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          )}
          {/* Same even, moderate scrim across the whole page (unlike the
              homepage's bottom-heavy one) — here the readable content
              spans top to bottom, not just a block anchored at the
              bottom. */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(11,46,44,0.55)", zIndex: 0 }} />
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, not worth next/image's overhead here */}
          <img src="/logo.png" alt="Nail Fest" style={{ height: 72, width: "auto", margin: "0 auto", display: "block" }} />
          {orgSettings.homepageTagline && (
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.8,
                textShadow: hasMedia ? "0 1px 6px rgba(0,0,0,0.35)" : "none",
              }}
            >
              {orgSettings.homepageTagline}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {links.length === 0 && (
            <p style={{ fontSize: 14, opacity: 0.7, textAlign: "center" }}>Próximamente más enlaces.</p>
          )}
          {links.map((link) => (
            <TrackedLink
              key={link.id}
              id={link.id}
              href={link.url}
              style={{
                display: "block",
                padding: "16px 20px",
                borderRadius: 999,
                // Frosted-white pill, dark text — picked over a translucent-
                // dark or brand-teal treatment (all three mocked up and
                // compared) specifically for max legibility over a busy
                // photo/video background without darkening the whole page.
                background: "rgba(255,255,255,0.92)",
                color: "var(--accent-ink)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                textAlign: ALIGN_CSS[link.textAlign],
                boxShadow: "0 6px 18px -8px rgba(0,0,0,0.45)",
              }}
            >
              {link.title}
            </TrackedLink>
          ))}
        </div>
      </div>
    </main>
  );
}

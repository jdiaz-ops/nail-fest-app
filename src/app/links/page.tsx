import { getOrgSettings } from "@/lib/settings";
import { getEnabledLinks } from "@/lib/linkPage";

export const dynamic = "force-dynamic";

// nailfest.co/links — the public Linktree-equivalent, managed from
// /admin/links. Header reuses the EXACT homepage header (src/app/page.tsx:
// logo centered, tagline in the same small uppercase "elegant label"
// style below it), so the two pages read as one brand. Each link renders
// either as a plain pill (no media) or, when it carries its own
// image/video, as the same "hero card" pattern as the homepage's own
// event box — full-bleed background media, dark gradient scrim, title as
// a pill button over it — see LinkPageLink's own schema comment.
export default async function LinksPage() {
  const [orgSettings, links] = await Promise.all([getOrgSettings(), getEnabledLinks()]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--accent-ink)",
        color: "#fff",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px 64px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
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
          {links.map((link) =>
            link.imageUrl || link.videoUrl ? (
              <LinkCard key={link.id} title={link.title} url={link.url} imageUrl={link.imageUrl} videoUrl={link.videoUrl} />
            ) : (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "16px 20px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {link.title}
              </a>
            )
          )}
        </div>
      </div>
    </main>
  );
}

// Same card pattern as the homepage's event box (src/app/page.tsx): a
// full-bleed background photo/video, a bottom-heavy dark gradient scrim
// for legibility, and the title rendered as the same pill CTA button —
// the whole card is the link, the pill is just how the title reads.
function LinkCard({
  title,
  url,
  imageUrl,
  videoUrl,
}: {
  title: string;
  url: string;
  imageUrl: string | null;
  videoUrl: string | null;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        position: "relative",
        display: "block",
        borderRadius: 20,
        overflow: "hidden",
        minHeight: 180,
        textDecoration: "none",
        background: "#0b2e2c",
      }}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- full-bleed card background from an admin-uploaded URL (photo or animated GIF)
        <img
          src={imageUrl!}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(11,46,44,0.05) 0%, rgba(11,46,44,0.15) 45%, rgba(11,46,44,0.88) 100%)",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, minHeight: 180, display: "flex", alignItems: "flex-end", padding: 16 }}>
        <span
          style={{
            display: "inline-block",
            padding: "14px 28px",
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 999,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            boxShadow: "0 10px 28px -10px rgba(0,0,0,0.55)",
          }}
        >
          {title}
        </span>
      </div>
    </a>
  );
}

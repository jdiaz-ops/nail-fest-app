import { getOrgSettings } from "@/lib/settings";
import { getEnabledLinks } from "@/lib/linkPage";

export const dynamic = "force-dynamic";

// nailfest.co/links — the public Linktree-equivalent, managed from
// /admin/links. Reuses the homepage's own logo+tagline treatment (see
// src/app/page.tsx) so the two pages read as the same brand, then lists
// every enabled LinkPageLink as a rounded pill — same basic structure as
// the user's reference Linktree screenshot (avatar, title, bio, pill
// links), v1 scope only (title + URL, no embedded widgets — see
// LinkPageLink's own schema comment for the deferred richer idea).
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
        padding: "48px 20px 64px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "#fff",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, not worth next/image's overhead here */}
          <img src="/logo.png" alt="Nail Fest" style={{ height: 60, width: "auto", display: "block" }} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 0" }}>{orgSettings.name}</h1>
        {orgSettings.homepageTagline && (
          <p style={{ fontSize: 14, margin: "6px 0 0", opacity: 0.8 }}>{orgSettings.homepageTagline}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
          {links.length === 0 && <p style={{ fontSize: 14, opacity: 0.7 }}>Próximamente más enlaces.</p>}
          {links.map((link) => (
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
              }}
            >
              {link.title}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

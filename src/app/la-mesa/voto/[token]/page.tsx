import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { getFirstEditionOn } from "@/lib/mesa/data";
import { percentages } from "@/lib/mesa/email";
import { MESA_SECTIONS } from "@/lib/mesa/sections";
import { votePage } from "@/lib/mesa/votes";
import VoteSaver from "./VoteSaver";

// What a tap in La Mesa's email opens (2026-10-25): Mito o verdad says
// whether she got it right and why, right away; El termómetro keeps her
// answer and says when the results come — in the next edition, which is
// the reason to open it. Her answer is saved by VoteSaver once this is on
// screen; tapping another option in the email changes it.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "La Mesa · Nail Fest", robots: { index: false, follow: false } };

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

const INK = "#17181c";
const BODY = "#33363d";

export default async function MesaVotePage({ params }: { params: { token: string } }) {
  const view = await votePage(params.token, await getFirstEditionOn());
  if (!view) notFound();

  const display = (size: number, color = INK) => ({ fontFamily: fraunces.style.fontFamily, fontWeight: 900, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.01em", color, margin: 0 });
  const label = (name: string, color: string, light = false) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 12.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: light ? "#fff" : color }}>
      <span aria-hidden="true" style={{ width: 16, height: 21, borderRadius: "50% 50% 5px 5px / 62% 62% 5px 5px", background: light ? "#fff" : color }} />
      {name}
    </div>
  );

  let body: React.ReactNode = null;
  let saved = "Tu respuesta quedó guardada.";
  if (view.mito) {
    const m = view.mito;
    body = (
      <>
        <section style={{ padding: "26px 24px", background: MESA_SECTIONS.MITO.color }}>
          {label("Mito o verdad", MESA_SECTIONS.MITO.color, true)}
          <p style={display(26, "#fff")}>«{m.statement}»</p>
          <p style={{ margin: "14px 0 0", fontSize: 14, color: "#ffe9e4" }}>Tu respuesta: {view.option === 0 ? "Mito" : "Verdad"}</p>
        </section>
        <section style={{ padding: "26px 24px" }}>
          <p style={display(34, m.right ? "#0d6e4f" : "#c2412f")}>{m.right ? "¡Acertaste!" : "Casi."}</p>
          <p style={{ margin: "8px 0 14px", fontSize: 18, fontWeight: 800, color: INK }}>{m.answer === "mito" ? "Es un mito." : "Es verdad."}</p>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: BODY }}>{m.explanation}</p>
          {m.rightPct !== null && (
            <p style={{ margin: "16px 0 0", padding: "12px 14px", borderRadius: 12, background: "#fbf6f1", fontSize: 14.5, color: INK }}>
              Hasta ahora, el <b>{m.rightPct}%</b> de la comunidad acertó.
            </p>
          )}
        </section>
      </>
    );
  } else if (view.termometro) {
    const t = view.termometro;
    const published = t.published && t.published.total > 0 ? t.published : null;
    saved = published ? "Tu respuesta quedó guardada." : `Tu respuesta quedó guardada. Los resultados salen en la próxima Mesa, el ${t.nextDate}.`;
    const pcts = published ? percentages(published.votes) : [];
    body = (
      <section style={{ padding: "26px 24px", background: "#fff4d6" }}>
        {label("El termómetro", MESA_SECTIONS.TERMOMETRO.color)}
        <p style={display(24)}>{t.question}</p>
        <div style={{ display: "grid", gap: 8, margin: "16px 0 4px" }}>
          {t.options.map((option, i) => {
            const mine = i === view.option;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `2px solid ${mine ? INK : "transparent"}`,
                  background: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  color: INK,
                }}
              >
                <span>
                  {option}
                  {mine && <small style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8a5d00" }}>Tu respuesta</small>}
                </span>
                {published && <b style={{ color: "#8a5d00" }}>{pcts[i]}%</b>}
              </div>
            );
          })}
        </div>
        {published ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: BODY }}>
            Estos fueron los resultados que salieron en La Mesa: votaron {published.total.toLocaleString("es-CO")} personas de la comunidad.
          </p>
        ) : (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: BODY }}>¿Te equivocaste? Toca otra opción en el correo y tu respuesta se cambia.</p>
        )}
      </section>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f1ede7", padding: "24px 16px 40px", fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 12px 34px rgba(23,24,28,.10)" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "20px 24px 18px", background: "#fbf6f1" }}>
          <p style={display(44)}>La Mesa</p>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b5f6b", paddingBottom: 6 }}>Edición {view.edition}</span>
        </header>
        {body}
        <div style={{ padding: "18px 24px 24px", borderTop: "1px solid #f0ece6" }}>
          <VoteSaver token={view.token} preview={view.preview} saved={saved} />
        </div>
      </div>
      <p style={{ maxWidth: 520, margin: "18px auto 0", textAlign: "center", fontSize: 13, lineHeight: 1.6, color: "#6c6f78" }}>
        La Mesa llega cada 15 días, el jueves, a la comunidad de Nail Fest.
        <br />
        <Link href="/" style={{ color: "#6c6f78" }}>
          nailfest.lat
        </Link>
      </p>
    </main>
  );
}

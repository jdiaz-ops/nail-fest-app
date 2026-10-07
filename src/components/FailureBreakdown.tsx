import Link from "next/link";
import RetryRecoverableButton from "@/components/RetryRecoverableButton";

// The "fallidos por motivo" page body both channels share: one card per
// plan of action (biggest group first) with its count, what to do, and
// the people in it folded away; a CSV of everyone; a retry button that
// only ever touches the retryable groups. Server component — the page
// hands it already-grouped rows.
export interface FailureGroupView {
  key: string;
  label: string;
  action: string;
  retryable: boolean;
  people: { name: string; contact: string; detail: string | null; status?: string }[];
}

export default function FailureBreakdown({
  title,
  subtitle,
  groups,
  summaryLines,
  csvUrl,
  retryUrl,
  channel,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle: string;
  groups: FailureGroupView[];
  /** The send's own numbers and automatic-retry status — the report that
   * used to be emailed now lives here. */
  summaryLines: string[];
  csvUrl: string;
  /** Null hides the manual retry — while the automatic retries are still
   * due there is nothing for a human to press. */
  retryUrl: string | null;
  channel: "whatsapp" | "email";
  backHref: string;
  backLabel: string;
}) {
  const total = groups.reduce((n, g) => n + g.people.length, 0);
  const retryable = groups.filter((g) => g.retryable).reduce((n, g) => n + g.people.length, 0);
  return (
    <div>
      <Link href={backHref} style={{ fontSize: 13 }}>
        ← {backLabel}
      </Link>
      <h1 style={{ fontSize: 20, margin: "12px 0 4px" }}>{title}</h1>
      <p style={{ color: "#5b5f6b", margin: "0 0 16px", maxWidth: 720 }}>{subtitle}</p>
      <div style={{ background: "#f6f5f2", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        {summaryLines.map((l, i) => (
          <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14 }}>
          <strong style={{ fontSize: 22 }}>{total}</strong> {total === 1 ? "fallido" : "fallidos"} ·{" "}
          <span style={{ color: retryable > 0 ? "#0e6b4c" : "#8a8478" }}>{retryable} recuperables</span> ·{" "}
          <span style={{ color: "#a3212b" }}>{total - retryable} no reintentar</span>
        </div>
        {retryUrl && <RetryRecoverableButton url={retryUrl} count={retryable} channel={channel} />}
        <a href={csvUrl} style={{ fontSize: 13, fontWeight: 600, color: "#0e6b4c" }}>
          Descargar CSV
        </a>
      </div>

      {groups.length === 0 && <p style={{ color: "#5b5f6b" }}>No hay fallidos en esta difusión.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((g) => (
          <section key={g.key} style={{ border: "1px solid #e8e6e1", borderRadius: 12, padding: "14px 16px", background: "#fff" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 22, minWidth: 48 }}>{g.people.length}</strong>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600 }}>{g.label}</div>
                <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>{g.action}</div>
              </div>
              <span
                style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: g.retryable ? "#e8f6ef" : "#fbe9ea", color: g.retryable ? "#0e6b4c" : "#a3212b" }}
              >
                {g.retryable ? "Se reintenta" : "No reintentar"}
              </span>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#0e6b4c", fontWeight: 600 }}>Ver personas</summary>
              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#8a8478", fontSize: 11 }}>
                      <th style={{ padding: "6px 8px" }}>Nombre</th>
                      <th style={{ padding: "6px 8px" }}>{channel === "whatsapp" ? "Celular" : "Correo"}</th>
                      <th style={{ padding: "6px 8px" }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.people.map((p, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f0efec" }}>
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{p.name}</td>
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{p.contact}</td>
                        <td style={{ padding: "6px 8px", color: "#5b5f6b", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.detail ?? ""}>
                          {p.detail ?? (p.status ? p.status : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}

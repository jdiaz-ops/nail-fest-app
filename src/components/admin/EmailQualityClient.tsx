"use client";

import { useState } from "react";

type Reason = "no_mail_server" | "no_mx_has_a" | "disposable_domain" | "likely_typo" | "role_based";

interface Finding {
  email: string;
  domain: string;
  reasons: Reason[];
  typoOf?: string;
}

interface Summary {
  totalChecked: number;
  totalDomains: number;
  countByReason: Record<Reason, number>;
  findings: Finding[];
  truncated: boolean;
}

const REASON_LABEL: Record<Reason, string> = {
  no_mail_server: "Sin servidor de correo (dominio no puede recibir nada)",
  no_mx_has_a: "Sin MX, pero el dominio existe (raro — revisar)",
  disposable_domain: "Correo temporal/desechable conocido",
  likely_typo: "Posible error de tipeo de un proveedor grande",
  role_based: "Correo de rol (info@, admin@...), no de una persona",
};

// Ordered worst-confidence-first — no_mail_server is the closest thing
// to "this WILL bounce" this checker can say without actually sending;
// the rest need a human glance before acting.
const REASON_ORDER: Reason[] = ["no_mail_server", "no_mx_has_a", "disposable_domain", "likely_typo", "role_based"];

// Every category the one-click "suprimir de una vez" button covers —
// all but role_based. A role-based local part (info@, admin@...) isn't
// "this will bounce", just "probably not a person" — a real inbox
// someone might still read — so that one stays a look-then-decide
// category instead of a bulk action. The other four all mean, in
// practice, "this address was never going to reach the person who wrote
// it" — worth suppressing even on a mere likely-typo/disposable-domain
// match: the cost of a false positive is low (they just stop getting
// marketing, nothing destructive, and a future registration re-grants
// consent normally) against the real, compounding cost of retrying a
// dead address on every future wave.
const SUPPRESSABLE_REASONS: Reason[] = ["no_mail_server", "no_mx_has_a", "disposable_domain", "likely_typo"];

export default function EmailQualityClient() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suppressState, setSuppressState] = useState<"idle" | "loading" | "done">("idle");
  const [suppressResult, setSuppressResult] = useState<{ matched: number } | null>(null);
  const [activeReason, setActiveReason] = useState<Reason | null>(null);

  async function analyze() {
    setState("loading");
    setSummary(null);
    setSuppressResult(null);
    const res = await fetch("/api/admin/crm/email-quality", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setSummary(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  async function submitSuppression(emails: string[]) {
    if (emails.length === 0) return;
    setSuppressState("loading");
    const res = await fetch("/api/admin/crm/suppress-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    const body = await res.json().catch(() => ({}));
    setSuppressState("done");
    if (res.ok && body.ok) setSuppressResult({ matched: body.matched });
  }

  function suppressReason(reason: Reason) {
    if (!summary) return;
    submitSuppression(summary.findings.filter((f) => f.reasons.includes(reason)).map((f) => f.email));
  }

  // The "no tener que hacer esto uno por uno" button — every email
  // caught by ANY suppressable category (see SUPPRESSABLE_REASONS'S own
  // comment on why role_based is the one left out), deduplicated, in one
  // request instead of clicking through each category's own button.
  function suppressAllProblematic() {
    if (!summary) return;
    const emails = [
      ...new Set(summary.findings.filter((f) => f.reasons.some((r) => SUPPRESSABLE_REASONS.includes(r))).map((f) => f.email)),
    ];
    submitSuppression(emails);
  }

  const problematicCount = summary
    ? new Set(summary.findings.filter((f) => f.reasons.some((r) => SUPPRESSABLE_REASONS.includes(r))).map((f) => f.email)).size
    : 0;

  const shownFindings = activeReason ? (summary?.findings.filter((f) => f.reasons.includes(activeReason)) ?? []) : (summary?.findings ?? []);

  return (
    <div>
      <button type="button" onClick={analyze} disabled={state === "loading"}>
        {state === "loading" ? "Analizando (puede tardar hasta un minuto)..." : "Analizar ahora"}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {summary && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16 }}>
            {summary.totalChecked.toLocaleString("es-CO")} correos revisados, en {summary.totalDomains.toLocaleString("es-CO")} dominios
            distintos.
          </p>

          {problematicCount > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button type="button" onClick={suppressAllProblematic} disabled={suppressState === "loading"}>
                {suppressState === "loading"
                  ? "Suprimiendo..."
                  : `Suprimir los ${problematicCount.toLocaleString("es-CO")} problemáticos de una vez`}
              </button>
              <p style={{ fontSize: 12, color: "#5b5f6b", margin: "6px 0 0" }}>
                Junta sin servidor + sin MX + desechable + posible typo en un solo clic. No incluye "correo de rol" — esos sí conviene
                mirarlos primero.
              </p>
              {suppressResult && (
                <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>✓ {suppressResult.matched} suprimidos de marketing.</p>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            {REASON_ORDER.map((reason) => {
              const count = summary.countByReason[reason];
              const isBad = reason === "no_mail_server";
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setActiveReason(activeReason === reason ? null : reason)}
                  style={{
                    textAlign: "left",
                    border: activeReason === reason ? "2px solid var(--accent, #00beb5)" : "1px solid #e3e1dc",
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: isBad && count > 0 ? "#fdeaea" : "#fff",
                    cursor: "pointer",
                    minWidth: 200,
                    flex: "1 1 220px",
                  }}
                >
                  <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: isBad && count > 0 ? "#a3251f" : undefined }}>{count}</p>
                  <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>{REASON_LABEL[reason]}</p>
                </button>
              );
            })}
          </div>

          {/* Suprimir de una vez — ver SUPPRESSABLE_REASONS's own comment
              arriba para por qué "correo de rol" se queda fuera. */}
          {activeReason && SUPPRESSABLE_REASONS.includes(activeReason) && summary.countByReason[activeReason] > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button type="button" onClick={() => suppressReason(activeReason)} disabled={suppressState === "loading"}>
                {suppressState === "loading" ? "Suprimiendo..." : `Suprimir estos ${summary.countByReason[activeReason]} de una vez`}
              </button>
              {suppressResult && (
                <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>
                  ✓ {suppressResult.matched} suprimidos de marketing.
                </p>
              )}
            </div>
          )}

          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 400, overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 12px" }}>Correo</th>
                  <th style={{ padding: "8px 12px" }}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {shownFindings.map((f) => (
                  <tr key={f.email} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px" }}>{f.email}</td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                      {f.reasons.map((r) => REASON_LABEL[r]).join(" · ")}
                      {f.typoOf && ` (¿${f.typoOf}?)`}
                    </td>
                  </tr>
                ))}
                {shownFindings.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                      Nada que mostrar en esta categoría.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {summary.truncated && (
            <p style={{ fontSize: 12, color: "#8a5a1f", marginTop: 8 }}>
              Se encontraron más de {summary.findings.length} correos con algo que revisar — se muestran solo los primeros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

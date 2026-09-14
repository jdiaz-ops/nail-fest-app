"use client";

import { useState } from "react";

type Reason =
  | "missing"
  | "no_plus_prefix"
  | "invalid_characters"
  | "too_short"
  | "too_long"
  | "fake_pattern"
  | "co_fixed_line"
  | "co_wrong_length"
  | "co_length_unexpected";

interface Finding {
  personId: string;
  phone: string | null;
  reasons: Reason[];
}

interface Summary {
  totalChecked: number;
  countByReason: Record<Reason, number>;
  findings: Finding[];
  truncated: boolean;
}

const REASON_LABEL: Record<Reason, string> = {
  missing: "Sin teléfono registrado",
  too_short: "Muy pocos dígitos para ser un número real",
  too_long: "Demasiados dígitos para ser un número real",
  fake_pattern: "Patrón obviamente falso (mismo dígito repetido, o consecutivo)",
  invalid_characters: "Tiene letras, espacios o símbolos raros",
  no_plus_prefix: "Sin prefijo de país (+) — puede ser válido, solo mal formateado",
  co_fixed_line: "Es un fijo colombiano real (60 + indicativo) — válido, pero no puede recibir WhatsApp",
  co_wrong_length: "Empieza en +57 pero no tiene los 10 dígitos que mide cualquier número colombiano",
  co_length_unexpected: "Empieza en +57, mide 10 dígitos, pero no empieza como celular (3) ni como fijo (60)",
};

// Peores/más ciertos primero — missing/too_short/too_long/fake_pattern/
// co_fixed_line/co_wrong_length son "esto no puede recibir WhatsApp,
// punto"; el último es formato ambiguo, una señal blanda que merece un
// vistazo, no un clic.
const REASON_ORDER: Reason[] = [
  "missing",
  "too_short",
  "too_long",
  "fake_pattern",
  "co_fixed_line",
  "co_wrong_length",
  "invalid_characters",
  "no_plus_prefix",
  "co_length_unexpected",
];

// A diferencia de no_plus_prefix (puede ser un número real solo le falta
// el +57 al inicio — arreglable, no hay que perder el contacto) y
// co_length_unexpected (10 dígitos, pero ninguna forma conocida — señal
// blanda de verdad), estos siete significan en la práctica "esto no
// puede recibir WhatsApp", igual que no_mail_server para correos —
// co_fixed_line porque es un fijo (WhatsApp no entrega a fijos sin
// importar qué tan bien formateado esté), co_wrong_length porque NINGÚN
// número colombiano válido tiene una longitud distinta a 10 dígitos, sin
// importar cuál dígito sobra o falta — no hay que adivinar cuál para
// tener certeza de que como está guardado, no sirve.
const SUPPRESSABLE_REASONS: Reason[] = [
  "missing",
  "invalid_characters",
  "too_short",
  "too_long",
  "fake_pattern",
  "co_fixed_line",
  "co_wrong_length",
];

export default function PhoneQualityClient() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suppressState, setSuppressState] = useState<"idle" | "loading" | "done">("idle");
  const [suppressResult, setSuppressResult] = useState<{ matched: number } | null>(null);
  const [activeReason, setActiveReason] = useState<Reason | null>(null);

  async function analyze() {
    setState("loading");
    setSummary(null);
    setSuppressResult(null);
    const res = await fetch("/api/admin/crm/phone-quality", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setSummary(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  async function submitSuppression(personIds: string[]) {
    if (personIds.length === 0) return;
    setSuppressState("loading");
    const res = await fetch("/api/admin/crm/suppress-phones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds }),
    });
    const body = await res.json().catch(() => ({}));
    setSuppressState("done");
    if (res.ok && body.ok) setSuppressResult({ matched: body.matched });
  }

  function suppressReason(reason: Reason) {
    if (!summary) return;
    submitSuppression(summary.findings.filter((f) => f.reasons.includes(reason)).map((f) => f.personId));
  }

  function suppressAllProblematic() {
    if (!summary) return;
    const ids = [
      ...new Set(summary.findings.filter((f) => f.reasons.some((r) => SUPPRESSABLE_REASONS.includes(r))).map((f) => f.personId)),
    ];
    submitSuppression(ids);
  }

  const problematicCount = summary
    ? new Set(summary.findings.filter((f) => f.reasons.some((r) => SUPPRESSABLE_REASONS.includes(r))).map((f) => f.personId)).size
    : 0;

  const shownFindings = activeReason ? (summary?.findings.filter((f) => f.reasons.includes(activeReason)) ?? []) : (summary?.findings ?? []);

  return (
    <div>
      <button type="button" onClick={analyze} disabled={state === "loading"}>
        {state === "loading" ? "Analizando..." : "Analizar teléfonos"}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {summary && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 16 }}>
            {summary.totalChecked.toLocaleString("es-CO")} números revisados (con consentimiento de WhatsApp activo).
          </p>

          {problematicCount > 0 && (
            <div style={{ marginBottom: 20 }}>
              <button type="button" onClick={suppressAllProblematic} disabled={suppressState === "loading"}>
                {suppressState === "loading"
                  ? "Suprimiendo..."
                  : `Suprimir los ${problematicCount.toLocaleString("es-CO")} problemáticos de una vez`}
              </button>
              <p style={{ fontSize: 12, color: "#5b5f6b", margin: "6px 0 0" }}>
                Junta sin-teléfono + muy corto/largo + patrón falso + caracteres inválidos + fijos colombianos (válidos, pero WhatsApp
                no les entrega) + longitud colombiana equivocada (11+ dígitos, ningún número real mide eso). No incluye "sin prefijo +"
                (puede ser válido, solo mal formateado) ni el caso de 10 dígitos que no arrancan como celular ni como fijo (señal
                blanda de verdad, mejor mirarla primero).
              </p>
              {suppressResult && (
                <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>✓ {suppressResult.matched} suprimidos de WhatsApp.</p>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            {REASON_ORDER.map((reason) => {
              const count = summary.countByReason[reason];
              const isBad = SUPPRESSABLE_REASONS.includes(reason);
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

          {activeReason && SUPPRESSABLE_REASONS.includes(activeReason) && summary.countByReason[activeReason] > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button type="button" onClick={() => suppressReason(activeReason)} disabled={suppressState === "loading"}>
                {suppressState === "loading" ? "Suprimiendo..." : `Suprimir estos ${summary.countByReason[activeReason]} de una vez`}
              </button>
              {suppressResult && (
                <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>
                  ✓ {suppressResult.matched} suprimidos de WhatsApp.
                </p>
              )}
            </div>
          )}

          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 400, overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 12px" }}>Teléfono</th>
                  <th style={{ padding: "8px 12px" }}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {shownFindings.map((f) => (
                  <tr key={f.personId} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px" }}>{f.phone || "(vacío)"}</td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{f.reasons.map((r) => REASON_LABEL[r]).join(" · ")}</td>
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
              Se encontraron más de {summary.findings.length} números con algo que revisar — se muestran solo los primeros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

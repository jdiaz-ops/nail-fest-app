"use client";

import { useState } from "react";

interface DomainRecordStatus {
  record: string; // "SPF" | "DKIM" | ...
  type: string;
  status: string; // "verified" | "pending" | "failed" | "temporary_failure" | "not_started"
}

interface DomainStatus {
  id: string;
  name: string;
  status: string; // "verified" | "pending" | "failed" | "not_started" | "partially_verified" | "partially_failed"
  records: DomainRecordStatus[];
}

function statusColor(status: string): { bg: string; ink: string } {
  if (status === "verified") return { bg: "#e6f9f7", ink: "#0e6b4c" };
  if (status === "pending" || status === "not_started") return { bg: "#fdf1e6", ink: "#8a5a1f" };
  return { bg: "#fdeaea", ink: "#a3251f" }; // failed, temporary_failure, partially_failed
}

export default function DomainAuthStatus() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [domains, setDomains] = useState<DomainStatus[] | null>(null);

  async function check() {
    setState("loading");
    const res = await fetch("/api/admin/crm/domain-status", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setConfigured(body.configured);
      setDomains(body.domains ?? null);
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div>
      <button type="button" onClick={check} disabled={state === "loading"}>
        {state === "loading" ? "Consultando Resend..." : "Verificar dominio de envío"}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {configured === false && (
        <p style={{ fontSize: 13, color: "#8a5a1f", marginTop: 12 }}>
          No hay RESEND_API_KEY configurada — si estás enviando por SES en vez de Resend, la verificación de dominio (SPF/DKIM) se revisa
          en la consola de AWS, no aquí.
        </p>
      )}

      {domains && domains.length === 0 && (
        <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 12 }}>No hay ningún dominio configurado en tu cuenta de Resend todavía.</p>
      )}

      {domains && domains.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          {domains.map((domain) => {
            const style = statusColor(domain.status);
            return (
              <div key={domain.id} style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>{domain.name}</p>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: style.bg,
                      color: style.ink,
                    }}
                  >
                    {domain.status}
                  </span>
                </div>
                {domain.records.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: 0 }}>Sin registros DNS reportados.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {domain.records.map((r, i) => {
                      const recordStyle = statusColor(r.status);
                      return (
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: recordStyle.bg,
                            color: recordStyle.ink,
                            fontWeight: 600,
                          }}
                        >
                          {r.record} ({r.type}): {r.status}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsultorioAdminData } from "@/lib/community/data";
import { api, CardTitle, cardStyle, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "../cuponera/ui";
import { FormError, Sheet, rowStyle } from "../biblioteca/ui";

const smallButton = { ...secondaryButtonStyle, padding: "5px 10px", fontSize: 12 };
const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

export default function ConsultorioAdmin({ published, canPublish, data }: { published: boolean; canPublish: boolean; data: ConsultorioAdminData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; email: string; text: string } | null>(null);
  const [filter, setFilter] = useState("");
  const requests = data.members.filter((m) => m.resetRequestedAt);
  const members = data.members.filter((m) => !filter.trim() || `${m.name} ${m.city} ${m.email}`.toLowerCase().includes(filter.trim().toLowerCase()));

  async function run(key: string, action: () => Promise<unknown>, failure = "No se pudo. Vuelve a intentarlo.") {
    setBusy(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Consultorio</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0 }}>
        Las preguntas y respuestas de la comunidad en nailfest.lat/consultorio. Para responder como «Equipo Nail Fest», entra al Consultorio con esta misma sesión.{" "}
        <a href="/consultorio" target="_blank" rel="noreferrer">
          Ver el Consultorio ↗
        </a>
      </p>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Consultorio público</div>
            <div style={{ ...mutedText, fontSize: 12 }}>
              {published
                ? "Público: cualquier persona lo ve, crea su cuenta y participa."
                : "Oculto: solo el equipo lo ve; el resto de las personas ven «página no encontrada»."}
            </div>
          </div>
          <Switch
            checked={published}
            disabled={!canPublish || busy === "publish"}
            label={published ? "Público" : "Oculto"}
            onChange={(next) => run("publish", () => api("/api/admin/library/settings", { method: "PATCH", body: JSON.stringify({ consultorioPublished: next }) }))}
          />
        </div>
        <div style={{ ...mutedText, fontSize: 12, marginTop: 10 }}>
          {many(data.counts.questions, "pregunta", "preguntas")} · {many(data.counts.answers, "respuesta", "respuestas")} · {many(data.counts.members, "cuenta", "cuentas")}
        </div>
      </div>
      {error && <FormError>{error}</FormError>}

      {requests.length > 0 && (
        <div style={{ ...cardStyle, borderColor: "#cfe0f5", background: "#f5f9ff" }}>
          <CardTitle>Pidieron cambiar su contraseña ({requests.length})</CardTitle>
          <p style={{ ...mutedText, marginTop: 0 }}>Crea su enlace y mándaselo por WhatsApp o por correo: sirve una vez, durante 7 días. No se le envía nada solo.</p>
          {requests.map((m) => (
            <div key={m.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {m.name} · {m.city}
                </div>
                <div style={{ ...mutedText, fontSize: 12 }}>
                  {m.email} · lo pidió el {m.resetRequestedLabel}
                </div>
              </div>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={busy === m.id}
                onClick={() =>
                  run(m.id, async () => {
                    const body = await api<{ text: string; email: string }>(`/api/admin/consultorio/miembros/${m.id}/enlace`, { method: "POST" });
                    setLink({ name: m.name, email: body.email, text: body.text });
                  })
                }
              >
                Crear enlace
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <CardTitle>Lo último que se publicó</CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>«Ocultar» lo saca del Consultorio sin borrarlo. Una respuesta oculta deja de ser «La que me resolvió».</p>
        {data.posts.length === 0 ? (
          <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>Todavía no hay preguntas.</p>
        ) : (
          data.posts.map((p) => (
            <div key={`${p.kind}-${p.id}`} style={{ ...rowStyle, alignItems: "flex-start", opacity: p.hidden || p.memberBlocked ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={p.kind === "question" ? "amber" : "grey"}>{p.kind === "question" ? "Pregunta" : "Respuesta"}</Pill>
                  {p.hidden && <Pill tone="red">Oculta</Pill>}
                  {p.memberBlocked && <Pill tone="red">Cuenta bloqueada</Pill>}
                  <span style={{ ...mutedText, fontSize: 12 }}>
                    {p.author} · {p.createdLabel}
                  </span>
                </div>
                <div style={{ fontSize: 14, marginTop: 4, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{p.text.length > 280 ? `${p.text.slice(0, 280)}…` : p.text}</div>
                {p.kind === "answer" && <div style={{ ...mutedText, fontSize: 12, marginTop: 2 }}>En: {p.questionTitle}</div>}
              </div>
              <a href={`/consultorio/${p.questionSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                Ver ↗
              </a>
              <button
                type="button"
                style={smallButton}
                disabled={busy === p.id}
                onClick={() => run(p.id, () => api("/api/admin/consultorio/moderar", { method: "POST", body: JSON.stringify({ kind: p.kind, id: p.id, hidden: !p.hidden }) }))}
              >
                {p.hidden ? "Mostrar" : "Ocultar"}
              </button>
            </div>
          ))
        )}
      </div>

      <div style={cardStyle}>
        <CardTitle>Cuentas de la comunidad</CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>«Bloquear» no la deja publicar y oculta lo que publicó; «Desbloquear» lo devuelve. Su correo nunca se publica.</p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre, ciudad o correo"
          style={{ width: "100%", padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, marginBottom: 8 }}
        />
        {members.length === 0 ? (
          <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>Todavía no hay cuentas.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {m.name} · {m.city} {m.blocked && <Pill tone="red">Bloqueada</Pill>}
                </div>
                <div style={{ ...mutedText, fontSize: 12 }}>
                  {m.email} · {many(m.questions, "pregunta", "preguntas")} · {many(m.answers, "respuesta", "respuestas")} · desde el {m.createdLabel}
                </div>
              </div>
              <button
                type="button"
                style={smallButton}
                disabled={busy === `link-${m.id}`}
                onClick={() =>
                  run(`link-${m.id}`, async () => {
                    const body = await api<{ text: string; email: string }>(`/api/admin/consultorio/miembros/${m.id}/enlace`, { method: "POST" });
                    setLink({ name: m.name, email: body.email, text: body.text });
                  })
                }
              >
                Enlace para cambiar contraseña
              </button>
              <button
                type="button"
                style={smallButton}
                disabled={busy === `block-${m.id}`}
                onClick={() => {
                  if (!m.blocked && !confirm(`¿Bloquear a ${m.name}? No podrá publicar y se ocultará lo que publicó.`)) return;
                  run(`block-${m.id}`, () => api(`/api/admin/consultorio/miembros/${m.id}`, { method: "PATCH", body: JSON.stringify({ blocked: !m.blocked }) }));
                }}
              >
                {m.blocked ? "Desbloquear" : "Bloquear"}
              </button>
            </div>
          ))
        )}
      </div>

      {link && <LinkSheet link={link} onClose={() => setLink(null)} />}
    </div>
  );
}

function LinkSheet({ link, onClose }: { link: { name: string; email: string; text: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title={`Enlace para ${link.name}`} onClose={onClose}>
      <p style={{ ...mutedText, marginTop: 0 }}>Con este enlace crea su contraseña nueva. Sirve una vez, durante 7 días. Mándaselo tú: por WhatsApp o a {link.email}.</p>
      <div className="field">
        <label htmlFor="member-link-text">Mensaje</label>
        <textarea id="member-link-text" rows={4} readOnly value={link.text} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copiado" : "Copiar mensaje"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(link.text)}`} target="_blank" rel="noreferrer" style={{ ...primaryButtonStyle, textDecoration: "none" }}>
          Abrir WhatsApp
        </a>
      </div>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

// Timezone options that actually matter for this audience — matches the
// same country set already offered for phone codes in RegistrationForm.tsx.
const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Bogota", label: "🇨🇴 Colombia (Bogotá)" },
  { value: "America/Mexico_City", label: "🇲🇽 México (CDMX)" },
  { value: "America/Lima", label: "🇵🇪 Perú (Lima)" },
  { value: "America/Guayaquil", label: "🇪🇨 Ecuador (Guayaquil)" },
  { value: "America/Panama", label: "🇵🇦 Panamá" },
  { value: "America/Caracas", label: "🇻🇪 Venezuela (Caracas)" },
  { value: "America/Santiago", label: "🇨🇱 Chile (Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "🇦🇷 Argentina (Buenos Aires)" },
  { value: "Europe/Madrid", label: "🇪🇸 España (Madrid)" },
  { value: "America/New_York", label: "🇺🇸 EE.UU. — Este" },
];

// timezone/language now genuinely drive every date/time shown to
// attendees and in the admin — see lib/dateFormat.ts and its call sites
// (event page, confirmation email, /admin/scan, /admin activity list).
export default function BasicSettingsForm({
  initialName,
  initialTimezone,
  initialLanguage,
}: {
  initialName: string;
  initialTimezone: string;
  initialLanguage: string;
}) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [language, setLanguage] = useState(initialLanguage);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await postSettings({ name, timezone, language });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="orgName">Nombre</label>
        <input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: -8 }}>
        Aparece en la firma de los correos de confirmación y en el encabezado de cada página de
        evento.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label htmlFor="timezone">Zona horaria</label>
          <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="language">Idioma</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: -8 }}>
        Cambia cómo se muestran las fechas y horas (página de evento, correo de confirmación,
        escáner) — no traduce el resto de la app, que sigue en español.
      </p>

      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}

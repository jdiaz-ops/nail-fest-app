"use client";

import { useState } from "react";

// Nail Fest Week sign-up. In the preview it saves nothing — the real one
// needs its own consent record for brand offers before it collects anyone.
export default function WeekSignup() {
  const [sent, setSent] = useState(false);
  return (
    <form
      className="cup-week-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="cup-week-row">
        <label htmlFor="cup-week-contact" className="cup-sr">
          Tu correo o WhatsApp
        </label>
        <input id="cup-week-contact" type="text" placeholder="Tu correo o WhatsApp" autoComplete="email" />
        <button type="submit">Avísame primero</button>
      </div>
      <span className="cup-week-legal">Al inscribirte aceptas recibir ofertas de las marcas aliadas de Nail Fest. Puedes salirte cuando quieras.</span>
      <span role="status" className="cup-week-msg">
        {sent ? "Vista previa: todavía no guardamos inscripciones." : ""}
      </span>
    </form>
  );
}

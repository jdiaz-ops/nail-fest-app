"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PersonFields {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  city: string | null;
  profession: string | null;
}

// The Bandeja sidebar's "fix it right here" edit — the real complaint
// this answers: an agent replying in WhatsApp notices the person's email
// on file is wrong (by far the most common reason someone says "no me
// llegó el correo") and today has no way to fix it without leaving the
// thread entirely. Edits go straight to the one Person row every other
// part of the CRM (segments, broadcasts, Meta Custom Audience sync)
// already reads fresh at send time — nothing else needs telling
// separately once this is saved.
export default function WhatsAppPersonEditForm({ person }: { person: PersonFields }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(person.firstName ?? "");
  const [lastName, setLastName] = useState(person.lastName ?? "");
  const [email, setEmail] = useState(person.email);
  const [city, setCity] = useState(person.city ?? "");
  const [profession, setProfession] = useState(person.profession ?? "");

  function cancel() {
    setFirstName(person.firstName ?? "");
    setLastName(person.lastName ?? "");
    setEmail(person.email);
    setCity(person.city ?? "");
    setProfession(person.profession ?? "");
    setError(null);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim(),
        city: city.trim() || null,
        profession: profession.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
      window.dispatchEvent(new Event("whatsapp-inbox-refresh"));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body?.message ?? "No se pudo guardar.");
    }
  }

  if (!editing) {
    return (
      <div>
        <SnapshotRow label="Nombre" value={[person.firstName, person.lastName].filter(Boolean).join(" ") || "—"} />
        <SnapshotRow label="Correo" value={person.email} />
        <SnapshotRow label="Ciudad" value={person.city || "—"} />
        <SnapshotRow label="Profesión" value={person.profession || "—"} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{ width: "auto", padding: "4px 10px", fontSize: 12, marginTop: 6 }}
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FieldRow label="Nombre">
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={inputStyle} />
      </FieldRow>
      <FieldRow label="Apellido">
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Correo">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
      </FieldRow>
      <FieldRow label="Ciudad">
        <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Profesión">
        <input value={profession} onChange={(e) => setProfession(e.target.value)} style={inputStyle} />
      </FieldRow>
      {error && <p style={{ fontSize: 12, color: "#c2185b", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="primary" type="submit" disabled={saving} style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={cancel} disabled={saving} style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#8a8478" }}>
      {label}
      {children}
    </label>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", gap: 8 }}>
      <span style={{ color: "#8a8478", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = { fontSize: 13, padding: "6px 8px", border: "1px solid #e3e1dc", borderRadius: 6 };

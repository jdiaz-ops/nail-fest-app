"use client";

import { useEffect, useRef, useState } from "react";
import { WORLD_COUNTRIES, findCountry, type WorldCountry } from "@/lib/worldCountries";

// The phone number's country, as a small dropdown under the field instead
// of the phone's own full-screen <select> sheet — Android opens that one
// scrolled to the selected row and covering the whole form. This one
// always opens at the top: Colombia and Venezuela (Cúcuta's two real
// audiences) first, then every country A–Z, those two included.
const SHORTCUTS: WorldCountry[] = ["CO", "VE"].map((iso2) => findCountry(iso2)).filter((c): c is WorldCountry => Boolean(c));
const ALL_AZ = [...WORLD_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "es"));

export default function PhoneCountryPicker({ value, onChange }: { value: string; onChange: (iso2: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = findCountry(value) ?? WORLD_COUNTRIES[0]!;

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: 0 });
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(iso2: string) {
    onChange(iso2);
    setOpen(false);
  }

  function row(c: WorldCountry, key: string, strong = false) {
    const isSelected = c.iso2 === value;
    return (
      <button
        key={key}
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => pick(c.iso2)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          padding: "10px 12px",
          border: "none",
          background: isSelected ? "#e6f9f7" : "transparent",
          color: "var(--ink)",
          fontSize: 15,
          fontWeight: strong || isSelected ? 600 : 400,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span>{c.name}</span>
        <span style={{ color: "var(--ink-muted)", flexShrink: 0 }}>{c.dialCode}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        type="button"
        aria-label="País del celular"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          // Sized to its text so "Venezuela (+58)" never gets cut off; a
          // very long country name is capped and ellipsized instead.
          maxWidth: 190,
          height: "100%",
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected.name} ({selected.dialCode})
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="País del celular"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            width: 260,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(23, 24, 28, 0.15)",
          }}
        >
          <div style={groupLabelStyle}>Más usados</div>
          {SHORTCUTS.map((c) => row(c, `top-${c.iso2}`, true))}
          <div style={{ ...groupLabelStyle, borderTop: "1px solid var(--border)", marginTop: 4 }}>Todos los países</div>
          {ALL_AZ.map((c) => row(c, c.iso2))}
        </div>
      )}
    </div>
  );
}

const groupLabelStyle: React.CSSProperties = {
  padding: "10px 12px 4px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
};

"use client";

import { useMemo, useRef, useState } from "react";
import { COLOMBIA_CITIES } from "@/lib/colombiaCities";
import { normalizeCityString, isKnownCityLabel } from "@/lib/cityMatch";

const MAX_SUGGESTIONS = 8;

// The forward half of "detectar misspells de ciudad" — a typeahead
// against the real DIVIPOLA municipality list (colombiaCities.ts) instead
// of a free-text <input>, so a new registration can only ever save a real
// city. Renders a real, name-d <input> so it drops into RegistrationForm's
// existing FormData-based submit unchanged — this component just adds the
// dropdown + validation on top of what was already a plain input.
export default function CityAutocomplete({
  id,
  name,
  required,
  defaultValue = "",
}: {
  id: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [touched, setTouched] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    const q = normalizeCityString(query);
    if (!q) return [];
    const startsWith = COLOMBIA_CITIES.filter((c) => normalizeCityString(c.label).startsWith(q));
    const contains = COLOMBIA_CITIES.filter(
      (c) => !normalizeCityString(c.label).startsWith(q) && normalizeCityString(c.label).includes(q)
    );
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query]);

  const isValid = !touched || query.trim() === "" || isKnownCityLabel(query);

  function select(label: string) {
    setQuery(label);
    setOpen(false);
    setTouched(true);
  }

  function handleBlur() {
    // Delayed so a click on a suggestion (which itself blurs the input)
    // still registers via onMouseDown before the list unmounts.
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      setTouched(true);
    }, 120);
  }

  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (query.trim()) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = suggestions[highlight];
      if (chosen) select(chosen.label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        // Real form field — the value here is exactly what
        // RegistrationForm's FormData-based submit reads, so selecting a
        // suggestion (or typing the exact real name) is all that's needed
        // for this to keep working as a drop-in replacement.
        name={name}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={!isValid}
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          setTouched(false);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Empieza a escribir tu ciudad…"
        style={!isValid ? { borderColor: "var(--danger, #c2185b)" } : undefined}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 220,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e3e1dc",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: 4,
            listStyle: "none",
          }}
        >
          {suggestions.map((c, i) => (
            <li key={c.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // onMouseDown (not onClick) fires BEFORE the input's onBlur,
                // so the selection registers before handleBlur's timer
                // would otherwise close the list out from under the click.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(c.label);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "none",
                  borderRadius: 6,
                  background: i === highlight ? "#f0faf8" : "transparent",
                  color: "#1c1310",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isValid && (
        <p style={{ fontSize: 12, color: "var(--danger, #c2185b)", margin: "4px 0 0" }}>
          Elige tu ciudad de la lista — empieza a escribir y selecciona una opción.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { formatPhoneDisplay } from "@/lib/brand";
import { matchRange, PERSON_SEARCH_MIN_LENGTH } from "@/lib/segments/personSearch";

// One person as the "Personas específicas" field shows them — what
// /api/admin/segments/people returns. The segment itself only ever stores
// `id` (the `person` condition, lib/segments/normalize.ts); the rest is
// just so a chip reads as a person instead of an id.
export interface PickedPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
}

// Stand-in for a saved segment's person whose details haven't loaded yet
// (SegmentComposer's edit mode) — keeps their id in the filter meanwhile,
// so saving before that lookup lands can't silently drop anyone.
export function pendingPerson(id: string): PickedPerson {
  return { id, firstName: null, lastName: null, email: "", phone: null, city: null };
}

function displayName(p: PickedPerson): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

function Highlight({ text, query }: { text: string; query: string }) {
  const range = matchRange(text, query);
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range[0])}
      <mark style={{ background: "#fde7d9", color: "inherit", borderRadius: 3, padding: "0 1px" }}>
        {text.slice(range[0], range[1])}
      </mark>
      {text.slice(range[1])}
    </>
  );
}

export default function SegmentPersonPicker({
  selected,
  onChange,
}: {
  selected: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const q = query.trim();
  const searchable = q.length >= PERSON_SEARCH_MIN_LENGTH;
  const selectedIds = new Set(selected.map((p) => p.id));

  // Debounced like the composer's live count — typing a phone digit by
  // digit shouldn't fire a search per keystroke. `ignore` drops an older,
  // slower response that lands after a newer one.
  useEffect(() => {
    if (!searchable) {
      setResults([]);
      setLoading(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/segments/people?q=${encodeURIComponent(q)}`).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => ({})) : {};
      if (ignore) return;
      setResults(body.people ?? []);
      setLoading(false);
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [q, searchable]);

  // Closes on a click anywhere outside this field rather than on blur —
  // blur fires before a click on "Agregar" inside the list would register.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function add(person: PickedPerson) {
    if (!selectedIds.has(person.id)) onChange([...selected, person]);
  }

  return (
    <div ref={wrapRef}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((p) => {
            const name = displayName(p);
            const detail = p.phone ? formatPhoneDisplay(p.phone) : name ? p.email : "";
            return (
              <span
                key={p.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#f0efec",
                  borderRadius: 999,
                  padding: "4px 6px 4px 12px",
                  fontSize: 12,
                }}
              >
                {name || p.email || "Cargando…"}
                {detail && <span style={{ color: "#5b5f6b" }}>{detail}</span>}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((s) => s.id !== p.id))}
                  aria-label={`Quitar a ${name || p.email}`}
                  style={{
                    border: 0,
                    background: "#e3e1dc",
                    color: "#5b5f6b",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    fontSize: 12,
                    lineHeight: "18px",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8a8478", pointerEvents: "none" }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Enter would otherwise submit the whole segment form — here
            // it adds the first result not already in the list instead.
            if (e.key === "Enter") {
              e.preventDefault();
              const first = results.find((p) => !selectedIds.has(p.id));
              if (first) add(first);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Celular o email"
          aria-label="Buscar por celular o email"
          autoComplete="off"
          style={{ paddingLeft: 36 }}
        />

        {open && searchable && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 20,
              background: "#fff",
              border: "1px solid #e3e1dc",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(20, 20, 30, 0.12)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {results.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "#5b5f6b" }}>
                {loading ? "Buscando…" : `Nadie coincide con «${q}».`}
              </div>
            ) : (
              results.map((p, i) => {
                const name = displayName(p);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 12px",
                      borderTop: i === 0 ? undefined : "1px solid #f0efec",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        <Highlight text={name || p.email} query={q} />
                        {p.city && <span style={{ fontWeight: 400, color: "#5b5f6b" }}> · {p.city}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#5b5f6b", overflowWrap: "anywhere" }}>
                        {name && <Highlight text={p.email} query={q} />}
                        {name && p.phone && " · "}
                        {p.phone && <Highlight text={formatPhoneDisplay(p.phone)} query={q} />}
                      </div>
                    </div>
                    {selectedIds.has(p.id) ? (
                      <span style={{ fontSize: 12, color: "#8a8478", whiteSpace: "nowrap" }}>Ya está</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(p)}
                        style={{
                          border: "1px solid #0e6b4c",
                          color: "#0e6b4c",
                          background: "#fff",
                          borderRadius: 999,
                          padding: "3px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {!q && <p style={{ fontSize: 12, color: "#8a8478", margin: "6px 0 0" }}>Escribe parte del celular o del email.</p>}
    </div>
  );
}

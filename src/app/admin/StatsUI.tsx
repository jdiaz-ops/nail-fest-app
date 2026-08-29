// Shared, plain-CSS building blocks for both event stats panels — see
// src/lib/eventStatsHelpers.ts's own comment for which panel is which.
// No charting library: these are the same handful of layout pieces
// (a stat tile, a labeled section, a horizontal bar row) reused across
// both, styled to match the rest of the admin (borders/tables already
// used everywhere else), not a separate visual language.

export const ACCENT = "#00beb5";

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "14px 16px", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#5b5f6b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 10 }}>{note}</p>
      {children}
    </div>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 12, color: "#5b5f6b" }}>{text}</p>;
}

export function ScrollBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e3e1dc", borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

export function BarList({ rows, max, showPct }: { rows: { label: string; count: number; pct?: number }[]; max: number; showPct?: boolean }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12 }}>
          <div
            style={{
              width: 120,
              flexShrink: 0,
              color: "#5b5f6b",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={r.label}
          >
            {r.label}
          </div>
          <div style={{ flex: 1, background: "#f0efec", borderRadius: 4, height: 14, position: "relative" }}>
            <div
              style={{
                width: `${max > 0 ? Math.max(r.count > 0 ? 2 : 0, (r.count / max) * 100) : 0}%`,
                background: ACCENT,
                height: "100%",
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ width: showPct ? 56 : 32, textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontWeight: 600 }}>{r.count}</span>
            {showPct && r.pct != null && <span style={{ color: "#5b5f6b" }}> · {r.pct}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

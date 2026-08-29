// Same shape as the StatCard on /admin (Resumen) — not imported from there
// since that one's a local function, not an exported component; kept
// consistent by eye instead of coupling the two sections together.
export default function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "16px 20px", minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

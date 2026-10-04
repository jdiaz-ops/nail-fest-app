"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlignedSummary, Pace } from "@/lib/registrationVelocity";

// "Ritmo de inscripción" — the interactive part: two ways to line events up
// (días antes del evento / días desde la apertura), the cumulative curves,
// and the comparison table. All numbers come computed from the server
// (lib/registrationVelocity.ts via lib/eventReportData.ts); this only draws.

export interface VelocityCurveData {
  id: string;
  name: string;
  total: number;
  launchDayCount: number;
  openingDaysBefore: number;
  // index d = cumulative registrations with ≥ d days to go
  cumulative: number[];
}

export interface VelocityRowData extends VelocityCurveData {
  atBefore: number;
  rhythmBefore: number;
  atSince: number;
  rhythmSince: number;
}

export interface VelocityPanelProps {
  target: VelocityCurveData;
  upcoming: boolean;
  daysBefore: number;
  daysSinceOpening: number;
  openingLabel: string;
  rhythm7: number;
  rows: VelocityRowData[];
  byDaysBefore: AlignedSummary;
  bySinceOpening: AlignedSummary;
  withoutDates: string[];
}

type Mode = "before" | "since";

const ACCENT = "#00beb5";
const INK = "#1c1310";
const MUTED = "#5b5f6b";
const GRID = "#efede8";
const PAST = "#cfcac1";
const PAST_HOVER = "#8a8478";
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const fmtRate = (n: number) => (n >= 10 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString("es-CO"));
const cum = (c: VelocityCurveData, d: number) => (d <= 0 ? c.total : d < c.cumulative.length ? c.cumulative[d]! : 0);

export const PACE_STYLE: Record<Pace, { icon: string; label: string; color: string }> = {
  ahead: { icon: "▲", label: "Acelerado", color: "#12966b" },
  on_track: { icon: "●", label: "En línea", color: INK },
  behind: { icon: "▼", label: "Por debajo", color: "#b25e00" },
};

// Top of the Y axis: four equal gridline steps, each a round number
// (… 2.500, 3.000, 4.000, 5.000 …) — 13.279 → 16.000, not 40.000.
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const raw = v / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x * p >= raw) ?? 10;
  return m * p * 4;
}

export default function VelocityPanel(props: VelocityPanelProps) {
  const { target, upcoming, daysBefore, daysSinceOpening, rows } = props;
  const [mode, setMode] = useState<Mode>("before");
  const summary = mode === "before" ? props.byDaysBefore : props.bySinceOpening;
  const pointLabel = mode === "before" ? `a ${daysBefore} ${daysBefore === 1 ? "día" : "días"} del evento` : `en su día ${daysSinceOpening} de inscripciones`;

  const cell: React.CSSProperties = { padding: "7px 12px", borderTop: "1px solid #f0efec" };
  const num: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const th: React.CSSProperties = { padding: "8px 12px", textAlign: "right" };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }} role="group" aria-label="Cómo alinear los eventos">
        {(
          [
            ["before", "Días antes del evento"],
            ["since", "Días desde la apertura"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 13,
              cursor: "pointer",
              border: `1px solid ${mode === m ? INK : "#e3e1dc"}`,
              background: mode === m ? INK : "#fff",
              color: mode === m ? "#fff" : INK,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {upcoming && (
        <p style={{ fontSize: 13, margin: "0 0 10px", color: INK }}>
          Hoy: faltan <strong>{daysBefore}</strong> {daysBefore === 1 ? "día" : "días"} · día <strong>{daysSinceOpening}</strong> desde la apertura (
          {props.openingLabel}).{" "}
          {summary.pace && summary.medianRhythm != null ? (
            <>
              <span style={{ color: PACE_STYLE[summary.pace].color, fontWeight: 700 }}>
                {PACE_STYLE[summary.pace].icon} {PACE_STYLE[summary.pace].label}
                {summary.paceRatio != null && summary.pace !== "on_track" && ` ${summary.paceRatio > 0 ? "+" : "−"}${Math.round(Math.abs(summary.paceRatio) * 100)} %`}
              </span>
              : {fmtRate(props.rhythm7)} inscritos por día en los últimos 7 días, frente a {fmtRate(summary.medianRhythm)} por día de los otros eventos {pointLabel} (mediana).
            </>
          ) : (
            "Todavía no hay eventos anteriores con fechas para comparar."
          )}
          {summary.projection && (
            <>
              {" "}
              Si sigue la forma de los otros eventos, terminaría con <strong>~{fmt(summary.projection.mid)}</strong> inscritos (entre {fmt(summary.projection.low)} y{" "}
              {fmt(summary.projection.high)}).
            </>
          )}
        </p>
      )}

      <VelocityChart mode={mode} target={target} rows={rows} upcoming={upcoming} daysBefore={daysBefore} daysSinceOpening={daysSinceOpening} />

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, margin: "12px 0" }}>
        <table className="forecast-table" style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "8px 12px" }}>Evento</th>
              {upcoming && <th style={th}>{mode === "before" ? `A ${daysBefore} días` : `Día ${daysSinceOpening}`}</th>}
              <th style={th}>{upcoming ? "Ritmo 7 días" : "Ritmo última semana"}</th>
              <th style={th}>Lanzamiento</th>
              <th style={th}>Total final</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontWeight: 700 }}>
              <td style={cell}>
                <span aria-hidden style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, background: ACCENT, marginRight: 6, verticalAlign: "middle" }} />
                Este evento
              </td>
              {upcoming && <td style={num}>{fmt(props.target.total)}</td>}
              <td style={num}>{fmtRate(props.rhythm7)}/día</td>
              <td style={num}>{fmt(target.launchDayCount)}</td>
              <td style={num}>{upcoming ? "—" : fmt(target.total)}</td>
            </tr>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.name}</td>
                {upcoming && <td style={num}>{fmt(mode === "before" ? r.atBefore : r.atSince)}</td>}
                <td style={num}>{fmtRate(mode === "before" ? r.rhythmBefore : r.rhythmSince)}/día</td>
                <td style={num}>{fmt(r.launchDayCount)}</td>
                <td style={num}>{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
        Inscripciones confirmadas (personas, no entradas). «Lanzamiento» = el primer día real de inscripciones — en casi todos los eventos es el
        día más grande, por eso el ritmo se mide con los últimos 7 días y no con el promedio desde la apertura.
        {props.withoutDates.length > 0 &&
          ` Sin fechas reales todavía (no se comparan): ${props.withoutDates.join(", ")} — sube su export de órdenes en CRM → Importar.`}
      </p>
    </div>
  );
}

function VelocityChart({
  mode,
  target,
  rows,
  upcoming,
  daysBefore,
  daysSinceOpening,
}: {
  mode: Mode;
  target: VelocityCurveData;
  rows: VelocityCurveData[];
  upcoming: boolean;
  daysBefore: number;
  daysSinceOpening: number;
}) {
  // Drawn at the container's real pixel width (not a scaled viewBox), so
  // text stays 11–12px on a phone and on a wide screen alike.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth - 16))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const H = narrow ? 240 : 300;
  const pad = { l: narrow ? 40 : 48, r: narrow ? 96 : 140, t: 14, b: 30 };
  const labelSize = narrow ? 10 : 11;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const geo = useMemo(() => {
    const all = [target, ...rows];
    // X runs over "units": days-before (maxUnit → 0) or day-of-sales (1 → maxUnit).
    const maxOpening = Math.min(150, Math.max(1, ...all.map((c) => c.openingDaysBefore)));
    const maxUnit = mode === "before" ? maxOpening : maxOpening + 1;
    const xOf = (u: number) => (mode === "before" ? pad.l + ((maxUnit - u) / maxUnit) * plotW : pad.l + ((u - 1) / Math.max(1, maxUnit - 1)) * plotW);
    // The value of curve c at x-unit u, or null outside its range.
    const valueAt = (c: VelocityCurveData, u: number, isTarget: boolean): number | null => {
      if (mode === "before") {
        if (u > Math.min(c.openingDaysBefore, maxUnit)) return null;
        if (isTarget && upcoming && u < daysBefore) return null;
        return cum(c, u);
      }
      const lastDay = isTarget && upcoming ? daysSinceOpening : c.openingDaysBefore + 1;
      if (u < 1 || u > Math.min(lastDay, maxUnit)) return null;
      return cum(c, c.openingDaysBefore - (u - 1));
    };
    const units = mode === "before" ? Array.from({ length: maxUnit + 1 }, (_, i) => maxUnit - i) : Array.from({ length: maxUnit }, (_, i) => i + 1);
    let yMaxRaw = 0;
    for (const c of all) for (const u of units) yMaxRaw = Math.max(yMaxRaw, valueAt(c, u, c === target) ?? 0);
    const yMax = niceMax(yMaxRaw);
    const yOf = (v: number) => pad.t + plotH - (v / yMax) * plotH;
    const pathOf = (c: VelocityCurveData, isTarget: boolean) => {
      const pts: string[] = [];
      let last: { x: number; y: number; v: number } | null = null;
      for (const u of units) {
        const v = valueAt(c, u, isTarget);
        if (v == null) continue;
        const x = xOf(u);
        const y = yOf(v);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        last = { x, y, v };
      }
      return { d: pts.length ? `M${pts.join("L")}` : "", last };
    };
    const targetPath = pathOf(target, true);
    const pastPaths = rows.map((c) => ({ c, ...pathOf(c, false) }));
    // End labels on the right, nudged apart so none overlap (≥ 13px).
    const labels = pastPaths
      .filter((p) => p.last)
      .map((p) => ({ id: p.c.id, text: p.c.name, y: p.last!.y }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i]!.y = Math.max(labels[i]!.y, labels[i - 1]!.y + (narrow ? 12 : 13));
    const overflow = labels.length ? labels[labels.length - 1]!.y - (pad.t + plotH) : 0;
    if (overflow > 0) labels.forEach((l) => (l.y -= overflow));
    // A tick every whole number of weeks, about five across.
    const step = Math.max(7, Math.ceil(maxUnit / 5 / 7) * 7);
    const xTicks = mode === "before" ? units.filter((u) => u % step === 0) : units.filter((u) => u === 1 || u % step === 0);
    return { maxUnit, units, xOf, yOf, yMax, valueAt, targetPath, pastPaths, labels, xTicks };
  }, [mode, target, rows, upcoming, daysBefore, daysSinceOpening, plotW, plotH, pad.l, pad.t, W]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const u of geo.units) {
      const dist = Math.abs(geo.xOf(u) - sx);
      if (dist < bestDist) {
        bestDist = dist;
        best = u;
      }
    }
    setHoverX(sx >= pad.l - 8 && sx <= W - pad.r + 8 ? best : null);
  }

  const hoverRows =
    hoverX == null
      ? []
      : [
          { id: target.id, name: "Este evento", v: geo.valueAt(target, hoverX, true), isTarget: true },
          ...rows.map((c) => ({ id: c.id, name: c.name, v: geo.valueAt(c, hoverX, false), isTarget: false })),
        ]
          .filter((r) => r.v != null)
          .sort((a, b) => b.v! - a.v!);
  const hoverLeftPct = hoverX == null ? 0 : (geo.xOf(hoverX) / W) * 100;
  const unitLabel = (u: number) => (mode === "before" ? (u === 0 ? "Día del evento" : `Faltan ${u} días`) : `Día ${u} de inscripciones`);
  const targetEnd = geo.targetPath.last;

  return (
    <div ref={wrapRef} style={{ position: "relative", border: "1px solid #e3e1dc", borderRadius: 10, padding: "8px 8px 4px", background: "#fff" }}>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: MUTED, padding: "2px 6px 6px", flexWrap: "wrap" }}>
        <span>
          <span aria-hidden style={{ display: "inline-block", width: 14, height: 3, borderRadius: 2, background: ACCENT, marginRight: 6, verticalAlign: "middle" }} />
          Este evento
        </span>
        <span>
          <span aria-hidden style={{ display: "inline-block", width: 14, height: 2, borderRadius: 2, background: PAST, marginRight: 6, verticalAlign: "middle" }} />
          Eventos anteriores
        </span>
        <span>Inscritos acumulados</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Inscritos acumulados de este evento comparados con los eventos anteriores"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = geo.yOf(geo.yMax * f);
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={11} fill={MUTED}>
                {fmt(geo.yMax * f)}
              </text>
            </g>
          );
        })}
        {geo.xTicks.map((u) => (
          <text key={u} x={geo.xOf(u)} y={H - 10} textAnchor="middle" fontSize={11} fill={MUTED}>
            {mode === "before" ? (u === 0 ? "Evento" : `${u} d`) : `Día ${u}`}
          </text>
        ))}

        {geo.pastPaths.map((p) => (
          <path
            key={p.c.id}
            d={p.d}
            fill="none"
            stroke={hoverId === p.c.id ? PAST_HOVER : PAST}
            strokeWidth={hoverId === p.c.id ? 2 : 1.5}
            strokeLinejoin="round"
            onMouseEnter={() => setHoverId(p.c.id)}
            onMouseLeave={() => setHoverId(null)}
          />
        ))}
        {geo.labels.map((l) => (
          <text key={l.id} x={W - pad.r + 6} y={l.y + 4} fontSize={labelSize} fill={hoverId === l.id ? INK : MUTED}>
            {narrow ? l.text.replace(/ · (\w+) (\d{2})(\d{2})$/, " · $1 $3") : l.text}
          </text>
        ))}

        {upcoming && targetEnd && (
          <line x1={targetEnd.x} x2={targetEnd.x} y1={pad.t} y2={pad.t + plotH} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}
        <path d={geo.targetPath.d} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {targetEnd && (
          <g>
            <circle cx={targetEnd.x} cy={targetEnd.y} r={4.5} fill={ACCENT} stroke="#fff" strokeWidth={2} />
            <text
              x={targetEnd.x + (targetEnd.x > W - pad.r - 90 ? -8 : 8)}
              y={targetEnd.y - 8}
              textAnchor={targetEnd.x > W - pad.r - 90 ? "end" : "start"}
              fontSize={12}
              fontWeight={700}
              fill={INK}
            >
              {upcoming ? `Hoy · ${fmt(targetEnd.v)}` : `Este evento · ${fmt(targetEnd.v)}`}
            </text>
          </g>
        )}

        {hoverX != null && <line x1={geo.xOf(hoverX)} x2={geo.xOf(hoverX)} y1={pad.t} y2={pad.t + plotH} stroke={INK} strokeWidth={1} opacity={0.25} />}
      </svg>

      {hoverX != null && hoverRows.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 36,
            left: `${hoverLeftPct}%`,
            transform: hoverLeftPct > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: "#fff",
            border: "1px solid #e3e1dc",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(28,19,16,0.10)",
            padding: "8px 10px",
            fontSize: 12,
            pointerEvents: "none",
            minWidth: 170,
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{unitLabel(hoverX)}</div>
          {hoverRows.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: r.isTarget ? 700 : 400 }}>
              <span>
                <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: r.isTarget ? ACCENT : PAST, marginRight: 6 }} />
                {r.name}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.v!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

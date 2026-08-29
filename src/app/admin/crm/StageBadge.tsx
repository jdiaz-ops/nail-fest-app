import { LIFECYCLE_LABEL, type LifecycleStage } from "@/lib/personTimeline";

// One badge component, used by both the Personas list and the person
// detail page — a shared spot so the two views can never render the same
// stage in two different colors.
const STAGE_STYLE: Record<LifecycleStage, { bg: string; ink: string }> = {
  LEAD: { bg: "#f6f5f2", ink: "#5b5f6b" },
  REGISTRADO: { bg: "#f6f5f2", ink: "#5b5f6b" },
  ASISTIO: { bg: "#e8f6ef", ink: "#0e6b4c" },
  RECURRENTE: { bg: "#e3faf7", ink: "var(--accent-ink)" },
  INACTIVO: { bg: "#fdf1e6", ink: "#8a5a1f" },
};

export default function StageBadge({ stage }: { stage: LifecycleStage }) {
  const style = STAGE_STYLE[stage];
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.ink,
        whiteSpace: "nowrap",
      }}
    >
      {LIFECYCLE_LABEL[stage]}
    </span>
  );
}

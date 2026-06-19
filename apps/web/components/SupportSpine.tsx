import { SUPPORT_COLORS } from "@/lib/analytics";
import type { Spine } from "@/lib/types";

const SEGMENTS: { key: keyof Spine; color: string; label: string }[] = [
  { key: "supportive", color: SUPPORT_COLORS.supportive, label: "Supportive" },
  { key: "undecided", color: SUPPORT_COLORS.undecided, label: "Undecided" },
  { key: "opposed", color: SUPPORT_COLORS.opposed, label: "Opposed" },
  { key: "notReached", color: SUPPORT_COLORS.notReached, label: "Not reached" },
];

/**
 * The signature support spine — a stacked Supportive/Undecided/Opposed/Not-reached bar
 * that recurs at every level of geography (Build Spec Section 10 / 10.1).
 */
export function SupportSpine({
  spine,
  height = 10,
  showLegend = false,
}: {
  spine: Spine;
  height?: number;
  showLegend?: boolean;
}) {
  const total = SEGMENTS.reduce((sum, s) => sum + spine[s.key], 0) || 1;
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full bg-muted"
        style={{ height }}
        role="img"
        aria-label="Support breakdown"
      >
        {SEGMENTS.map((s) => {
          const w = (spine[s.key] / total) * 100;
          if (w === 0) return null;
          return (
            <div
              key={s.key}
              style={{ width: `${w}%`, backgroundColor: s.color }}
              title={`${s.label}: ${spine[s.key]} (${Math.round(w)}%)`}
            />
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="tnum text-slate-400">{spine[s.key]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

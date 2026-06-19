"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BRAND, SUPPORT_COLORS } from "@/lib/analytics";
import type { ClassDistribution, FunnelStage, RegionComparison, Spine } from "@/lib/types";

const CLASS_COLORS: Record<string, string> = {
  stronghold: BRAND.green600,
  lean: "#3B82C4",
  tossup: "#DDA02C",
  weak: "#D64A3C",
};

const tooltipStyle = { borderRadius: 8, border: "1px solid #E3E8F0", fontSize: 12 } as const;

/** Support funnel: Delegates → Called → Reached → Supportive (Section 11). */
export function FunnelBars({ data }: { data: FunnelStage[] }) {
  const max = data[0]?.value || 1;
  return (
    <div className="space-y-3">
      {data.map((s, i) => {
        const w = (s.value / max) * 100;
        const conv = i === 0 ? 100 : Math.round((s.value / data[i - 1].value) * 100);
        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{s.stage}</span>
              <span className="tnum text-slate-500">
                {s.value.toLocaleString()}
                {i > 0 && <span className="ml-2 text-xs text-slate-400">{conv}% of prev</span>}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
              <div
                className="flex h-full items-center rounded-md bg-gradient-to-r from-brand-700 to-brand-400"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Coverage vs projected support per region. */
export function RegionBars({ data }: { data: RegionComparison[] }) {
  const rows = data.map((r) => ({
    name: r.code,
    Coverage: Math.round(r.coverage * 100),
    Projected: Math.round(r.projected * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="%" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Coverage" fill="#B2BAC8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Projected" fill={BRAND.green600} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Classification distribution of constituencies (Stronghold/Lean/Tossup/Weak). */
export function ClassDonut({ data }: { data: ClassDistribution[] }) {
  const rows = data.map((d) => ({ name: d.classification, value: d.count }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {rows.map((r) => (
            <Cell key={r.name} fill={CLASS_COLORS[r.name]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** National support composition donut. */
export function SupportDonut({ spine }: { spine: Spine }) {
  const rows = [
    { name: "Supportive", value: spine.supportive, color: SUPPORT_COLORS.supportive },
    { name: "Undecided", value: spine.undecided, color: SUPPORT_COLORS.undecided },
    { name: "Opposed", value: spine.opposed, color: SUPPORT_COLORS.opposed },
    { name: "Not reached", value: spine.notReached, color: SUPPORT_COLORS.notReached },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

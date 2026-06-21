import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CLASS_LABEL } from "@/lib/analytics";
import type { Classification } from "@/lib/types";
import { Card as ShadCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Padded convenience card used across the dashboard. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ShadCard className={cn("p-5", className)}>{children}</ShadCard>;
}

export function Kpi({
  label,
  value,
  sub,
  delta,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Trend in percentage points vs previous period. Positive = up. */
  delta?: number;
  /** Show a green left accent bar (e.g. for headline KPIs). */
  accent?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn("relative overflow-hidden transition-shadow hover:shadow-md", accent && "pl-6")}>
      {accent && <span className="absolute inset-y-0 left-0 w-1.5 bg-primary" />}
      <div className="flex items-start justify-between">
        <div className="kpi-label">{label}</div>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tnum",
              up ? "bg-brand-50 text-brand-700" : "bg-rose-50 text-rose-600",
            )}
          >
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {up ? "+" : ""}
            {delta}pp
          </span>
        )}
      </div>
      <div className="tnum mt-2 text-3xl font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

const CLASS_VARIANT: Record<Classification, "green" | "sky" | "amber" | "red" | "secondary"> = {
  stronghold: "green",
  lean: "sky",
  tossup: "amber",
  weak: "red",
  unrated: "secondary",
};

export function ClassBadge({ value }: { value: Classification }) {
  return <Badge variant={CLASS_VARIANT[value]}>{CLASS_LABEL[value]}</Badge>;
}

type Tone = "slate" | "green" | "amber" | "red" | "blue";
const TONE_VARIANT: Record<Tone, "secondary" | "green" | "amber" | "red" | "blue"> = {
  slate: "secondary",
  green: "green",
  amber: "amber",
  red: "red",
  blue: "blue",
};

export function Pill({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <Badge variant={TONE_VARIANT[tone]}>{children}</Badge>;
}

import { Gauge } from "lucide-react";
import { Card } from "@/components/primitives";
import { fmt, pct } from "@/lib/analytics";
import type { PaceToTarget } from "@/lib/types";

export function PaceCard({ pace }: { pace: PaceToTarget }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Gauge size={16} className="text-primary" /> Pace to target
        </h2>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            pace.onPace ? "bg-brand-50 text-brand-700" : "bg-rose-100 text-rose-700"
          }`}
        >
          {pace.onPace ? "On pace" : "Behind pace"}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className="tnum text-3xl font-semibold text-foreground">{pct(pace.reachedToTarget)}</span>
        <span className="mb-1 text-sm text-muted-foreground">of {fmt(pace.target)} target contacts</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: pct(pace.reachedToTarget) }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="tnum text-lg font-semibold text-foreground">{pace.reachedPerDay}</div>
          <div className="kpi-label">Reached/day</div>
        </div>
        <div>
          <div className="tnum text-lg font-semibold text-foreground">{pace.requiredPerDay}</div>
          <div className="kpi-label">Needed/day</div>
        </div>
        <div>
          <div className="tnum text-lg font-semibold text-foreground">{pace.daysLeft}</div>
          <div className="kpi-label">Days left</div>
        </div>
      </div>
    </Card>
  );
}

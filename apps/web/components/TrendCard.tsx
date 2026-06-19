"use client";

import { useState } from "react";
import type { DailyReached } from "@/lib/types";
import { Card } from "@/components/primitives";
import { ReachedChart } from "@/components/ReachedChart";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
];

export function TrendCard({ data }: { data: DailyReached[] }) {
  const [days, setDays] = useState(14);
  const sliced = data.slice(-days);
  const total = sliced.reduce((s, d) => s + d.reached, 0);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Reached per day</h2>
          <p className="tnum text-xs text-muted-foreground">{total.toLocaleString()} reached over {days} days</p>
        </div>
        <div className="flex rounded-lg border border-input p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                days === r.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ReachedChart data={sliced} />
    </Card>
  );
}

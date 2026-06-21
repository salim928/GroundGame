"use client";

import { Download, Printer } from "lucide-react";
import type { PriorityConstituency, RegionComparison } from "@/lib/types";
import { pct } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { downloadCsv, printPage } from "@/lib/export";

export function AnalyticsActions({
  regions,
  priority,
}: {
  regions: RegionComparison[];
  priority: PriorityConstituency[];
}) {
  function exportCsv() {
    const rows = [
      ...regions.map((r) => ({
        Type: "Region",
        Name: r.name,
        Delegates: r.delegates,
        Coverage: pct(r.coverage),
      })),
      ...priority.map((p) => ({
        Type: "Priority constituency",
        Name: p.name,
        Delegates: p.delegates,
        Coverage: pct(p.coverage),
      })),
    ];
    downloadCsv("groundgame-analytics", rows);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv}>
        <Download /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={printPage}>
        <Printer /> Export PDF
      </Button>
    </div>
  );
}

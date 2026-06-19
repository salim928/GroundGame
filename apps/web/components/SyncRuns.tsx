"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import type { SyncOverview, SyncRun } from "@/lib/types";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const STATUS: Record<SyncRun["status"], { variant: "green" | "amber" | "red" | "secondary"; label: string; Icon: typeof CheckCircle2 }> = {
  success: { variant: "green", label: "Success", Icon: CheckCircle2 },
  partial: { variant: "amber", label: "Partial", Icon: TriangleAlert },
  failed: { variant: "red", label: "Failed", Icon: XCircle },
  running: { variant: "secondary", label: "Running", Icon: Loader2 },
};

export function SyncRuns({ overview }: { overview: SyncOverview }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(overview.lastSyncMins);
  const [runs, setRuns] = useState(overview.runs);

  function forceSync() {
    // POST /sync/run — Super Admin forces an immediate sync of all sheets (Section 8.3).
    setSyncing(true);
    setRuns((r) => r.map((x) => ({ ...x, status: "running" as const })));
    setTimeout(() => {
      setRuns(overview.runs.map((x) => ({ ...x, finishedAt: "just now" })));
      setLastSync(0);
      setSyncing(false);
    }, 1600);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <div className="kpi-label">Last sync</div>
          <div className="tnum mt-2 text-3xl font-semibold text-foreground">{lastSync}m</div>
          <div className="mt-1 text-xs text-muted-foreground">next in {overview.nextSyncMins}m · every 15m</div>
        </Card>
        <Card>
          <div className="kpi-label">Sheets synced</div>
          <div className="tnum mt-2 text-3xl font-semibold text-foreground">
            {overview.sheetsSynced}/{overview.sheetsTotal}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{overview.staleSheets} stale</div>
        </Card>
        <Card>
          <div className="kpi-label">Open conflicts</div>
          <div className="tnum mt-2 text-3xl font-semibold text-foreground">{overview.conflictsOpen}</div>
          <div className="mt-1 text-xs text-muted-foreground">awaiting review</div>
        </Card>
        <Card className="flex flex-col justify-between">
          <div className="kpi-label">Manual sync</div>
          <Button onClick={forceSync} disabled={syncing} className="mt-2 w-full">
            <RefreshCw className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Force sync all"}
          </Button>
        </Card>
      </div>

      <Card className="mt-4 p-0">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-semibold text-foreground">Recent sync runs</h2>
          <span className="text-xs text-muted-foreground">{runs.length} constituencies</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Constituency</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Pulled</TableHead>
              <TableHead className="text-right">Written</TableHead>
              <TableHead className="text-right">Conflicts</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => {
              const s = STATUS[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.constituency}</TableCell>
                  <TableCell className="text-muted-foreground">{r.region}</TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>
                      <s.Icon size={12} className={r.status === "running" ? "animate-spin" : ""} />
                      {s.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{r.rowsPulled}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{r.rowsWritten}</TableCell>
                  <TableCell className="tnum text-right">
                    {r.conflicts > 0 ? <span className="font-medium text-rose-600">{r.conflicts}</span> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{r.durationSec}s</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{r.finishedAt}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

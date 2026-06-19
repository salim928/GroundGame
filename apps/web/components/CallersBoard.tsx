"use client";

import { useMemo, useState } from "react";
import { Download, GraduationCap, Trophy } from "lucide-react";
import type { CallerPerf } from "@/lib/types";
import { fmt, pct } from "@/lib/analytics";
import { Card, Kpi } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/export";

export function CallersBoard({ callers }: { callers: CallerPerf[] }) {
  const regions = useMemo(() => ["All regions", ...Array.from(new Set(callers.map((c) => c.region)))], [callers]);
  const [region, setRegion] = useState("All regions");

  const rows = region === "All regions" ? callers : callers.filter((c) => c.region === region);
  const totalAttempts = rows.reduce((s, c) => s + c.attempts, 0);
  const totalReached = rows.reduce((s, c) => s + c.reached, 0);
  const avgConversion = rows.length ? rows.reduce((s, c) => s + c.conversion, 0) / rows.length : 0;

  function exportCsv() {
    downloadCsv(
      `callers-${region.toLowerCase().replace(/\s+/g, "-")}`,
      rows.map((c) => ({
        Caller: c.label,
        Region: c.region,
        Constituency: c.constituency,
        Attempts: c.attempts,
        Reached: c.reached,
        ReachRate: pct(c.reachRate),
        Conversion: pct(c.conversion),
        Flag: c.flag ?? "",
      })),
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Active callers" value={fmt(rows.length)} />
        <Kpi label="Total attempts" value={fmt(totalAttempts)} />
        <Kpi label="Reach rate" value={pct(totalAttempts ? totalReached / totalAttempts : 0)} />
        <Kpi label="Avg conversion" value={pct(avgConversion)} />
      </div>

      <Card className="mt-4 p-0">
        <h2 className="p-5 pb-3 font-semibold text-foreground">Leaderboard</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Constituency</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Reach rate</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead>Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c, i) => (
              <TableRow key={c.label}>
                <TableCell className="tnum text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium text-foreground">{c.label}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.constituency}
                  <span className="text-muted-foreground/60"> · {c.region}</span>
                </TableCell>
                <TableCell className="tnum text-right text-muted-foreground">{c.attempts}</TableCell>
                <TableCell className="tnum text-right text-muted-foreground">{pct(c.reachRate)}</TableCell>
                <TableCell className="tnum text-right font-medium text-foreground">{pct(c.conversion)}</TableCell>
                <TableCell>
                  {c.flag === "top" && (
                    <Badge variant="green">
                      <Trophy size={12} /> Top
                    </Badge>
                  )}
                  {c.flag === "coach" && (
                    <Badge variant="amber">
                      <GraduationCap size={12} /> Coach
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

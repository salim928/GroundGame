"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Search, Users } from "lucide-react";
import { Card, Kpi } from "@/components/primitives";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Con {
  id: string;
  name: string;
  code: string;
  delegates: number;
}
interface Region {
  name: string;
  code: string;
  constituencies: Con[];
}

export function DirectoryBrowser({
  regions,
  stats,
}: {
  regions: Region[];
  stats: { constituencies: number; delegates: number };
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const totalCons = regions.reduce((s, r) => s + r.constituencies.length, 0);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return regions;
    return regions
      .map((r) => {
        if (r.name.toLowerCase().includes(t)) return r;
        const cons = r.constituencies.filter((c) => c.name.toLowerCase().includes(t));
        return cons.length ? { ...r, constituencies: cons } : null;
      })
      .filter(Boolean) as Region[];
  }, [q, regions]);

  const searching = q.trim().length > 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Regions" value={regions.length} />
        <Kpi label="Constituencies" value={totalCons} />
        <Kpi label="With rosters" value={stats.constituencies} sub={`${Math.round((stats.constituencies / totalCons) * 100)}% coverage`} />
        <Kpi label="Delegates on file" value={stats.delegates.toLocaleString()} />
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search regions or constituencies…" className="pl-9" />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((r) => {
          const regionDelegates = r.constituencies.reduce((s, c) => s + c.delegates, 0);
          const isOpen = searching || open[r.code];
          return (
            <Card key={r.code} className="overflow-hidden p-0">
              <button
                onClick={() => setOpen((o) => ({ ...o, [r.code]: !o[r.code] }))}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight size={16} className={cn("text-muted-foreground transition", isOpen && "rotate-90")} />
                  <MapPin size={16} className="text-primary" />
                  <span className="font-semibold text-foreground">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.constituencies.length} constituencies</span>
                </div>
                <Badge variant="secondary">
                  <Users size={12} /> {regionDelegates}
                </Badge>
              </button>

              {isOpen && (
                <div className="grid grid-cols-1 gap-1.5 border-t border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {r.constituencies.map((c) => (
                    <Link
                      key={c.id}
                      href={`/constituencies/${c.id}`}
                      className="flex items-center justify-between rounded-lg border border-transparent bg-card px-3 py-2 text-sm transition hover:border-primary/30 hover:shadow-sm"
                    >
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                      {c.delegates > 0 ? (
                        <Badge variant="green" className="shrink-0">
                          {c.delegates}
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">—</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="py-12 text-center text-sm text-muted-foreground">No matches for “{q}”.</Card>
        )}
      </div>
    </>
  );
}

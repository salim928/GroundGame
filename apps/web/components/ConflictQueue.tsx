"use client";

import { useState } from "react";
import { AlertTriangle, Check, Users } from "lucide-react";
import type { Conflict } from "@/lib/types";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";

// Potential duplicate delegates (same phone or identical name in a constituency).
// Dismiss is client-side; the real fix is to deactivate the extra entry on the
// constituency's roster.
export function ConflictQueue({ initial }: { initial: Conflict[] }) {
  const [queue, setQueue] = useState(initial);

  function dismiss(id: string) {
    setQueue((q) => q.filter((c) => c.id !== id));
  }

  if (queue.length === 0) {
    return (
      <Card className="flex flex-col items-center py-16 text-center">
        <Check className="mb-3 text-emerald-500" size={32} />
        <p className="font-medium text-ink">No duplicates found</p>
        <p className="text-sm text-slate-400">Every delegate in your scope looks unique.</p>
      </Card>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {queue.length} potential duplicate{queue.length === 1 ? "" : "s"} — open the constituency to deactivate the extra entry.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {queue.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{c.constituency}</div>
                <div className="text-xs text-slate-400">{c.branch}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <AlertTriangle size={12} /> Possible duplicate
              </span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {c.rawFlags.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-ink">
                  <Users size={13} className="shrink-0 text-slate-400" /> {f}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => dismiss(c.id)}>
                Dismiss
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

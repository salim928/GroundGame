"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import type { Conflict } from "@/lib/types";
import { Card } from "@/components/primitives";

const OUTCOMES = [
  { value: "supportive", label: "Supportive", color: "#2E9E6B" },
  { value: "undecided", label: "Undecided", color: "#DDA02C" },
  { value: "hostile", label: "Opposed", color: "#D64A3C" },
  { value: "wrong_number", label: "Wrong number", color: "#B2BAC8" },
] as const;

export function ConflictQueue({ initial }: { initial: Conflict[] }) {
  const [queue, setQueue] = useState(initial);

  function resolve(id: string) {
    // POST /conflicts/:id/resolve — sets true outcome, clears Sheet CONFLICT status (Section 12).
    setQueue((q) => q.filter((c) => c.id !== id));
  }

  if (queue.length === 0) {
    return (
      <Card className="flex flex-col items-center py-16 text-center">
        <Check className="mb-3 text-emerald-500" size={32} />
        <p className="font-medium text-ink">No open conflicts</p>
        <p className="text-sm text-slate-400">Everything reconciled. New clashes appear here within one sync cycle.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {queue.map((c) => (
        <Card key={c.id}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-ink">{c.delegateName}</div>
              <div className="text-xs text-slate-400">
                {c.constituency} · {c.branch} · {c.createdAt}
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              <AlertTriangle size={12} /> Conflict
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">Clashing ticks:</span>
            {c.rawFlags.map((f) => (
              <span key={f} className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-ink">
                {f}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-slate-500">Set true outcome</div>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => resolve(c.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent/5"
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: o.color }} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

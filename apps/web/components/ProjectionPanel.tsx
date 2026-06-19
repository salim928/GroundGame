"use client";

import { useMemo, useState } from "react";
import { classify, CLASS_LABEL, pct, projectShare, spineTotal } from "@/lib/analytics";
import type { ProjectionPayload, Spine } from "@/lib/types";
import { Card } from "@/components/primitives";
import { SupportSpine } from "@/components/SupportSpine";

export function ProjectionPanel({ payload }: { payload: ProjectionPayload }) {
  const [convert, setConvert] = useState(0); // share of undecided converted to supportive
  const [weights, setWeights] = useState(payload.weights);

  const scenario: Spine = useMemo(() => {
    const moved = Math.round(payload.spine.undecided * (convert / 100));
    return {
      ...payload.spine,
      supportive: payload.spine.supportive + moved,
      undecided: payload.spine.undecided - moved,
    };
  }, [payload.spine, convert]);

  const current = projectShare(payload.spine, weights);
  const projected = projectShare(scenario, weights);
  const total = spineTotal(payload.spine);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <h2 className="mb-1 font-semibold text-ink">Current vs scenario</h2>
        <p className="mb-4 text-xs text-slate-400">
          {spineTotal(payload.spine).toLocaleString()} delegates · directional signal, not a forecast
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="kpi-label">Current projected support</div>
            <div className="tnum text-4xl font-semibold text-ink">{pct(current)}</div>
            <div className="mt-1 text-xs text-slate-400">{CLASS_LABEL[classify(current)]}</div>
            <div className="mt-3"><SupportSpine spine={payload.spine} height={14} /></div>
          </div>
          <div>
            <div className="kpi-label">Scenario projected support</div>
            <div className="tnum text-4xl font-semibold text-accent">{pct(projected)}</div>
            <div className="mt-1 text-xs text-slate-400">
              {CLASS_LABEL[classify(projected)]} ·{" "}
              <span className={projected >= current ? "text-emerald-600" : "text-rose-600"}>
                {projected >= current ? "+" : ""}
                {pct(projected - current)}
              </span>
            </div>
            <div className="mt-3"><SupportSpine spine={scenario} height={14} /></div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="convert" className="font-medium text-ink">
              Convert undecided → supportive
            </label>
            <span className="tnum text-slate-500">
              {convert}% ({Math.round(payload.spine.undecided * (convert / 100))} delegates)
            </span>
          </div>
          <input
            id="convert"
            type="range"
            min={0}
            max={100}
            value={convert}
            onChange={(e) => setConvert(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-ink">Projection weights</h2>
        <p className="mb-4 text-xs text-slate-400">
          Stored in <code>app_config</code> — set by the campaign lead (Section 3.2).
        </p>
        <div className="space-y-4">
          {(
            [
              ["supportive", "Supportive"],
              ["undecided", "Undecided"],
              ["not_reached", "Not reached"],
              ["opposed", "Opposed"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <span className="tnum font-medium text-ink">{weights[key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="mt-1 w-full accent-accent"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => setWeights(payload.weights)}
          className="mt-5 w-full rounded-lg border border-border py-2 text-sm font-medium text-slate-600 hover:bg-muted"
        >
          Reset to saved weights
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Confidence band: {pct(payload.confidenceBand[0])}–{pct(payload.confidenceBand[1])}
        </p>
      </Card>
    </div>
  );
}

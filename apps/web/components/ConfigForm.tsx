"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { getAccessToken } from "@/lib/supabase";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Config {
  targetDays: number;
  targetContacts: number;
  weights: { supportive: number; undecided: number; not_reached: number; opposed: number };
  thresholds: { stronghold: number; lean: number; tossup: number; weak: number };
}

const DEFAULTS: Config = {
  targetDays: 21,
  targetContacts: 10,
  weights: { supportive: 1.0, undecided: 0.35, not_reached: 0.15, opposed: 0.0 },
  thresholds: { stronghold: 0.65, lean: 0.55, tossup: 0.45, weak: 0.0 },
};

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ConfigForm() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        setMsg({ ok: false, text: "Sign in as a super admin to edit campaign settings." });
        return;
      }
      try {
        const res = await fetch("/api/config", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.config) setCfg({ ...DEFAULTS, ...json.config });
        else setMsg({ ok: false, text: json.error ?? "Could not load settings." });
      } catch {
        setMsg({ ok: false, text: "Could not load settings." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setW = (k: keyof Config["weights"], v: number) =>
    setCfg((c) => ({ ...c, weights: { ...c.weights, [k]: v } }));
  const setT = (k: keyof Config["thresholds"], v: number) =>
    setCfg((c) => ({ ...c, thresholds: { ...c.thresholds, [k]: v } }));

  async function save() {
    setMsg(null);
    // Thresholds should descend so bands don't overlap.
    const { stronghold, lean, tossup } = cfg.thresholds;
    if (!(stronghold >= lean && lean >= tossup)) {
      setMsg({ ok: false, text: "Thresholds must descend: Stronghold ≥ Lean ≥ Tossup." });
      return;
    }
    setBusy(true);
    const token = await getAccessToken();
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          campaign: { targetDays: cfg.targetDays, targetContacts: cfg.targetContacts },
          weights: cfg.weights,
          thresholds: cfg.thresholds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Could not save settings." });
      } else {
        if (json.config) setCfg({ ...DEFAULTS, ...json.config });
        setMsg({ ok: true, text: "Saved. New values apply across the dashboard." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save settings." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> Loading settings…
      </Card>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <h2 className="font-semibold text-foreground">Targets</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Drive the pace-to-target maths on the overview and the per-constituency contact goal.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="targetDays"
            label="Days left in calling window"
            hint="Used to compute the required reach per day."
            value={cfg.targetDays}
            min={1}
            max={365}
            step={1}
            onChange={(v) => setCfg((c) => ({ ...c, targetDays: v }))}
          />
          <NumberField
            id="targetContacts"
            label="Target contacts per constituency"
            hint="The per-constituency contact goal."
            value={cfg.targetContacts}
            min={1}
            max={100000}
            step={1}
            onChange={(v) => setCfg((c) => ({ ...c, targetContacts: v }))}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Projection weights</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          How each response counts toward a constituency&apos;s projected support share (0–1).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField id="w-sup" label="Supportive" value={cfg.weights.supportive} min={0} max={1} step={0.05} onChange={(v) => setW("supportive", v)} />
          <NumberField id="w-und" label="Undecided" value={cfg.weights.undecided} min={0} max={1} step={0.05} onChange={(v) => setW("undecided", v)} />
          <NumberField id="w-nr" label="Not reached" value={cfg.weights.not_reached} min={0} max={1} step={0.05} onChange={(v) => setW("not_reached", v)} />
          <NumberField id="w-opp" label="Opposed" value={cfg.weights.opposed} min={0} max={1} step={0.05} onChange={(v) => setW("opposed", v)} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Classification thresholds</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Minimum projected share for each band (must descend). Below Tossup is Weak.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="t-strong" label="Stronghold ≥" value={cfg.thresholds.stronghold} min={0} max={1} step={0.05} onChange={(v) => setT("stronghold", v)} />
          <NumberField id="t-lean" label="Lean ≥" value={cfg.thresholds.lean} min={0} max={1} step={0.05} onChange={(v) => setT("lean", v)} />
          <NumberField id="t-toss" label="Tossup ≥" value={cfg.thresholds.tossup} min={0} max={1} step={0.05} onChange={(v) => setT("tossup", v)} />
        </div>
      </Card>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
            msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {msg.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
          {msg.text}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> Saving…</> : <><Save /> Save settings</>}
        </Button>
        <Button variant="outline" onClick={() => setCfg(DEFAULTS)} disabled={busy}>
          <RotateCcw /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}

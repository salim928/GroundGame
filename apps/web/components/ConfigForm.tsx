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

// Editable fields, in order. Decimal fields are 0–1; the two targets are integers.
type FieldKey =
  | "targetDays"
  | "targetContacts"
  | "w_supportive"
  | "w_undecided"
  | "w_not_reached"
  | "w_opposed"
  | "t_stronghold"
  | "t_lean"
  | "t_tossup";

type Draft = Record<FieldKey, string>;

function toDraft(c: Config): Draft {
  return {
    targetDays: String(c.targetDays),
    targetContacts: String(c.targetContacts),
    w_supportive: String(c.weights.supportive),
    w_undecided: String(c.weights.undecided),
    w_not_reached: String(c.weights.not_reached),
    w_opposed: String(c.weights.opposed),
    t_stronghold: String(c.thresholds.stronghold),
    t_lean: String(c.thresholds.lean),
    t_tossup: String(c.thresholds.tossup),
  };
}

// Parse a draft string, falling back to the last-saved value when it's blank/invalid.
function n(v: string, fallback: number): number {
  const x = Number(v);
  return v.trim() !== "" && Number.isFinite(x) ? x : fallback;
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {/* type=text + inputMode=decimal so a decimal point can actually be typed
          (controlled type=number wipes the "." mid-entry). */}
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ConfigForm() {
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULTS));
  const [saved, setSaved] = useState<Config>(DEFAULTS);
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
        if (res.ok && json.config) {
          const cfg = { ...DEFAULTS, ...json.config } as Config;
          setSaved(cfg);
          setDraft(toDraft(cfg));
        } else {
          setMsg({ ok: false, text: json.error ?? "Could not load settings." });
        }
      } catch {
        setMsg({ ok: false, text: "Could not load settings." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: FieldKey, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  function resolved(): Config {
    return {
      targetDays: n(draft.targetDays, saved.targetDays),
      targetContacts: n(draft.targetContacts, saved.targetContacts),
      weights: {
        supportive: n(draft.w_supportive, saved.weights.supportive),
        undecided: n(draft.w_undecided, saved.weights.undecided),
        not_reached: n(draft.w_not_reached, saved.weights.not_reached),
        opposed: n(draft.w_opposed, saved.weights.opposed),
      },
      thresholds: {
        stronghold: n(draft.t_stronghold, saved.thresholds.stronghold),
        lean: n(draft.t_lean, saved.thresholds.lean),
        tossup: n(draft.t_tossup, saved.thresholds.tossup),
        weak: 0,
      },
    };
  }

  async function save() {
    setMsg(null);
    const cfg = resolved();
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
        const next = (json.config ? { ...DEFAULTS, ...json.config } : cfg) as Config;
        setSaved(next);
        setDraft(toDraft(next));
        setMsg({ ok: true, text: "Saved. New values apply across the dashboard." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save settings." });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSaved(DEFAULTS);
    setDraft(toDraft(DEFAULTS));
    setMsg(null);
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
            hint="Used to compute the required reach per day (1–365)."
            value={draft.targetDays}
            onChange={(v) => set("targetDays", v)}
          />
          <NumberField
            id="targetContacts"
            label="Target contacts per constituency"
            hint="The per-constituency contact goal."
            value={draft.targetContacts}
            onChange={(v) => set("targetContacts", v)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Projection weights</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          How each response counts toward a constituency&apos;s projected support share (0–1).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField id="w-sup" label="Supportive" value={draft.w_supportive} onChange={(v) => set("w_supportive", v)} />
          <NumberField id="w-und" label="Undecided" value={draft.w_undecided} onChange={(v) => set("w_undecided", v)} />
          <NumberField id="w-nr" label="Not reached" value={draft.w_not_reached} onChange={(v) => set("w_not_reached", v)} />
          <NumberField id="w-opp" label="Opposed" value={draft.w_opposed} onChange={(v) => set("w_opposed", v)} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Classification thresholds</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Minimum projected share for each band, 0–1 (must descend). Below Tossup is Weak.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="t-strong" label="Stronghold ≥" value={draft.t_stronghold} onChange={(v) => set("t_stronghold", v)} />
          <NumberField id="t-lean" label="Lean ≥" value={draft.t_lean} onChange={(v) => set("t_lean", v)} />
          <NumberField id="t-toss" label="Tossup ≥" value={draft.t_tossup} onChange={(v) => set("t_tossup", v)} />
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
        <Button variant="outline" onClick={reset} disabled={busy}>
          <RotateCcw /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}

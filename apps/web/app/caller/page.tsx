"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Phone,
  PhoneCall,
  Target,
  TriangleAlert,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { clearSession, getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Outcome = "supportive" | "undecided" | "hostile" | "wrong_number";

interface CallState {
  called: boolean;
  reached: boolean;
  outcome: Outcome | null;
}

interface Row extends CallState {
  id: string;
  name: string;
  phone: string | null;
  position: string | null;
  saving?: boolean;
  saved?: boolean;
  dirty?: boolean;
}

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "supportive", label: "Supportive" },
  { value: "undecided", label: "Undecided" },
  { value: "hostile", label: "Opposed" },
  { value: "wrong_number", label: "Wrong number" },
];

export default function CallerConsolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.role !== "caller") {
      router.replace("/dashboard");
      return;
    }
    setName(session.name);

    const supa = getSupabase();
    if (!supa) {
      setError("Sign-in is not configured for this environment.");
      setLoading(false);
      return;
    }
    const { data: auth } = await supa.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }

    // Your constituency (RLS lets you read your own profile + its constituency).
    const { data: profile } = await supa
      .from("profiles")
      .select("full_name, constituencies(name, code, regions(name))")
      .eq("user_id", auth.user.id)
      .single();
    const con = (profile as any)?.constituencies;
    setScope(con ? `${con?.regions?.name ?? ""} · ${con?.name ?? ""}` : "No constituency assigned");

    // Your delegates only — RLS limits this to your assigned constituency.
    const { data: dels, error: delErr } = await supa
      .from("delegates")
      .select("id, full_name, phone, position, call_records(called, reached, outcome)")
      .eq("is_active", true)
      .order("position");
    if (delErr) {
      setError("Could not load your delegate list. Ask your coordinator to confirm your assignment.");
      setLoading(false);
      return;
    }
    setRows(
      (dels ?? []).map((d: any) => {
        const cr = Array.isArray(d.call_records) ? d.call_records[0] : d.call_records;
        return {
          id: d.id,
          name: d.full_name,
          phone: d.phone,
          position: d.position,
          called: cr?.called ?? false,
          reached: cr?.reached ?? false,
          outcome: (cr?.outcome as Outcome) ?? null,
        };
      }),
    );
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const progress = useMemo(() => {
    const called = rows.filter((r) => r.called).length;
    const reached = rows.filter((r) => r.reached).length;
    const supportive = rows.filter((r) => r.outcome === "supportive").length;
    return { total: rows.length, called, reached, supportive };
  }, [rows]);

  function patch(id: string, next: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next, dirty: true, saved: false } : r)));
  }

  async function save(row: Row) {
    const supa = getSupabase();
    if (!supa) return;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, saving: true } : r)));
    const { error: upErr } = await supa.from("call_records").upsert(
      {
        delegate_id: row.id,
        caller_label: name || null,
        called: row.called,
        reached: row.reached,
        outcome: row.reached ? row.outcome : null,
        source: "app",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "delegate_id" },
    );
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id ? { ...r, saving: false, saved: !upErr, dirty: Boolean(upErr) } : r,
      ),
    );
  }

  async function signOut() {
    clearSession();
    try {
      await getSupabase()?.auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-ink text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-primary" />
            <div>
              <div className="text-sm font-semibold leading-tight">GroundGame · Caller</div>
              <div className="text-xs text-slate-400">{scope}</div>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-foreground">Hi {name.split(" ")[0] || "there"} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Call your delegates and log each outcome. Your progress updates the campaign dashboard live.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2">
          {[
            { label: "Delegates", value: progress.total },
            { label: "Called", value: progress.called },
            { label: "Reached", value: progress.reached },
            { label: "Supportive", value: progress.supportive },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="tnum text-2xl font-semibold text-foreground">{k.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="animate-spin" size={18} /> Loading your delegates…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <TriangleAlert size={15} /> {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No delegates are loaded for your constituency yet. Check back once your coordinator syncs the roster.
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.position && <Badge variant="secondary">{r.position}</Badge>}
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="tnum flex items-center gap-1 text-primary hover:underline">
                        <Phone size={12} /> {r.phone}
                      </a>
                    )}
                  </div>
                </div>
                {r.saved && !r.dirty && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={14} /> Saved
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch(r.id, { called: !r.called, ...(r.called ? { reached: false, outcome: null } : {}) })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    r.called ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-primary",
                  )}
                >
                  <PhoneCall size={12} className="mr-1 inline" /> Called
                </button>
                <button
                  type="button"
                  disabled={!r.called}
                  onClick={() => patch(r.id, { reached: !r.reached, ...(r.reached ? { outcome: null } : {}) })}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40",
                    r.reached ? "border-emerald-600 bg-emerald-600 text-white" : "border-input text-muted-foreground hover:border-emerald-600",
                  )}
                >
                  Reached
                </button>

                {r.reached && (
                  <select
                    value={r.outcome ?? ""}
                    onChange={(e) => patch(r.id, { outcome: (e.target.value || null) as Outcome | null })}
                    className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                  >
                    <option value="">Outcome…</option>
                    {OUTCOMES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}

                <div className="ml-auto">
                  <Button size="sm" disabled={!r.dirty || r.saving} onClick={() => save(r)}>
                    {r.saving ? <Loader2 className="animate-spin" size={14} /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

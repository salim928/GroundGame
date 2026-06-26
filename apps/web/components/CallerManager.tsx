"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, PhoneCall, UserPlus, X } from "lucide-react";
import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { getSession } from "@/lib/session";
import { getAccessToken } from "@/lib/supabase";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CallerRow {
  userId: string;
  fullName: string;
  isActive: boolean;
  constituency: string | null;
  region: string | null;
}

const MANAGER_ROLES = ["super_admin", "regional_coordinator", "constituency_coordinator"];

function makePassword() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `${pick(alpha, 6)}-${pick(digits, 4)}-${pick(alpha, 3)}`;
}

export function CallerManager() {
  const [role, setRole] = useState<string | null>(null);
  const [callers, setCallers] = useState<CallerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string; constituency: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [regionCode, setRegionCode] = useState(REAL_HIERARCHY[0].code);
  const [conCode, setConCode] = useState(REAL_HIERARCHY[0].constituencies[0].code);
  const [lockRegion, setLockRegion] = useState(false);
  const [lockCon, setLockCon] = useState(false);

  const region = useMemo(() => REAL_HIERARCHY.find((r) => r.code === regionCode)!, [regionCode]);
  const canManage = role !== null && MANAGER_ROLES.includes(role);
  // Constrain the add-form to the manager's own area (server enforces this too).
  const regionOptions = lockRegion ? REAL_HIERARCHY.filter((r) => r.code === regionCode) : REAL_HIERARCHY;
  const conOptions = lockCon ? region.constituencies.filter((c) => c.code === conCode) : region.constituencies;

  async function refresh() {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/callers", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCallers((await res.json()).callers ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    const s = getSession();
    setRole(s?.role ?? null);
    // Pre-scope the form: constituency coordinators are locked to their one
    // constituency; regional coordinators to their region.
    if (s?.conCode) {
      const reg = REAL_HIERARCHY.find((r) => r.constituencies.some((c) => c.code === s.conCode));
      if (reg) {
        setRegionCode(reg.code);
        setConCode(s.conCode);
        setLockRegion(true);
        setLockCon(true);
      }
    } else if (s?.regionCode) {
      const reg = REAL_HIERARCHY.find((r) => r.code === s.regionCode);
      if (reg) {
        setRegionCode(reg.code);
        setConCode(reg.constituencies[0].code);
        setLockRegion(true);
      }
    }
    refresh();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim()) return;
    setBusy(true);
    const password = makePassword();
    const token = await getAccessToken();
    try {
      const res = await fetch("/api/callers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password, constituencyCode: conCode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create the caller.");
      } else {
        setCreated({ email: email.trim(), password, constituency: json.constituency ?? region.name });
        setFullName("");
        setEmail("");
        setOpen(false);
        refresh();
      }
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  async function deactivate(userId: string) {
    const token = await getAccessToken();
    await fetch(`/api/callers?id=${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` } });
    refresh();
  }

  if (!canManage) return null;

  return (
    <Card className="mb-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <PhoneCall size={16} className="text-primary" /> Field callers
          </h2>
          <p className="text-xs text-muted-foreground">
            Each caller signs in to a console limited to the one constituency you assign.
          </p>
        </div>
        <Button onClick={() => { setOpen((v) => !v); setCreated(null); }}>
          {open ? <X /> : <UserPlus />}
          {open ? "Cancel" : "Add caller"}
        </Button>
      </div>

      {created && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-medium text-emerald-800">
            Caller created for {created.constituency}. Share these credentials securely — the password isn't shown again.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <code className="rounded bg-white px-2 py-1">{created.email}</code>
            <code className="rounded bg-white px-2 py-1">{created.password}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(`${created.email} / ${created.password}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">Full name</Label>
            <Input id="cf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Kojo Mensah" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-email">Email (their login)</Label>
            <Input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="caller@groundgame.gh" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-region">Region</Label>
            <select
              id="cf-region"
              value={regionCode}
              disabled={lockRegion}
              onChange={(e) => {
                setRegionCode(e.target.value);
                const r = REAL_HIERARCHY.find((x) => x.code === e.target.value)!;
                setConCode(r.constituencies[0].code);
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-70"
            >
              {regionOptions.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-con">Constituency</Label>
            <select
              id="cf-con"
              value={conCode}
              disabled={lockCon}
              onChange={(e) => setConCode(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-70"
            >
              {conOptions.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">A secure password is generated and shown once after you create.</p>
            <Button type="submit" disabled={busy}>
              {busy ? <><Loader2 className="animate-spin" /> Creating…</> : "Create caller"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading callers…</p>
      ) : callers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          No callers yet. Add one to give field volunteers a scoped login.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Assigned constituency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callers.map((c) => (
              <TableRow key={c.userId}>
                <TableCell className="font-medium text-foreground">{c.fullName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.region ? `${c.region} · ${c.constituency}` : c.constituency ?? "—"}
                </TableCell>
                <TableCell>
                  {c.isActive ? <Badge variant="green">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {c.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => deactivate(c.userId)}>
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

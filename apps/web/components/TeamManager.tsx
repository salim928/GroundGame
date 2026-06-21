"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, UserPlus, X } from "lucide-react";
import type { Member, Role } from "@/lib/types";
import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { getAccessToken } from "@/lib/supabase";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  regional_coordinator: "Regional Coordinator",
  constituency_coordinator: "Constituency Coordinator",
  analyst: "Analyst",
  caller: "Caller",
};
const ROLE_TONE: Record<string, "blue" | "green" | "amber" | "secondary"> = {
  super_admin: "blue",
  regional_coordinator: "green",
  constituency_coordinator: "amber",
  analyst: "secondary",
  caller: "secondary",
};
const STAFF_ROLES: Role[] = ["super_admin", "regional_coordinator", "constituency_coordinator", "analyst"];

function makePassword() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `${pick(alpha, 6)}-${pick(digits, 4)}-${pick(alpha, 3)}`;
}

export function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("constituency_coordinator");
  const [regionCode, setRegionCode] = useState(REAL_HIERARCHY[0].code);
  const [conCode, setConCode] = useState(REAL_HIERARCHY[0].constituencies[0].code);

  const region = useMemo(() => REAL_HIERARCHY.find((r) => r.code === regionCode)!, [regionCode]);
  const needsRegion = role === "regional_coordinator" || role === "constituency_coordinator";
  const needsConstituency = role === "constituency_coordinator";

  async function refresh() {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/members", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMembers((await res.json()).members ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim()) return;
    setBusy(true);
    const password = makePassword();
    const token = await getAccessToken();
    const payload: Record<string, string> = { fullName: fullName.trim(), email: email.trim(), password, role };
    if (needsRegion) payload.regionCode = regionCode;
    if (needsConstituency) payload.constituencyCode = conCode;
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create member.");
      } else {
        setCreated({ email: email.trim(), password });
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
    await fetch(`/api/members?id=${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` } });
    refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setOpen((v) => !v); setCreated(null); }}>
          {open ? <X /> : <UserPlus />}
          {open ? "Cancel" : "Create member"}
        </Button>
      </div>

      {created && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-medium text-emerald-800">
            Member created. Share these credentials securely — the password isn&apos;t shown again.
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
        <Card className="mb-4">
          <h2 className="mb-4 font-semibold text-foreground">Create member &amp; assign scope</h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ama Mensah" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@groundgame.gh" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>

            {needsRegion && (
              <div className="space-y-1.5">
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={regionCode}
                  onChange={(e) => {
                    setRegionCode(e.target.value);
                    const r = REAL_HIERARCHY.find((x) => x.code === e.target.value)!;
                    setConCode(r.constituencies[0].code);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {REAL_HIERARCHY.map((r) => (
                    <option key={r.code} value={r.code}>{r.name} ({r.constituencies.length})</option>
                  ))}
                </select>
              </div>
            )}

            {needsConstituency && (
              <div className="space-y-1.5">
                <Label htmlFor="con">Constituency</Label>
                <select
                  id="con"
                  value={conCode}
                  onChange={(e) => setConCode(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {region.constituencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">A secure password is generated and shown once after you create.</p>
              <Button type="submit" disabled={busy}>
                {busy ? <><Loader2 className="animate-spin" /> Creating…</> : "Create & assign"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading members…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium text-foreground">{m.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_TONE[m.role] ?? "secondary"}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.scope}</TableCell>
                  <TableCell>
                    {m.isActive ? <Badge variant="green">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.isActive && m.role !== "super_admin" && (
                      <Button variant="ghost" size="sm" onClick={() => deactivate(m.userId)}>
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No members loaded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import type { Member, Role } from "@/lib/types";
import { REAL_HIERARCHY } from "@/lib/hierarchy";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  regional_coordinator: "Regional Coordinator",
  constituency_coordinator: "Constituency Coordinator",
  analyst: "Analyst",
};
const ROLE_TONE: Record<Role, "blue" | "green" | "amber" | "secondary"> = {
  super_admin: "blue",
  regional_coordinator: "green",
  constituency_coordinator: "amber",
  analyst: "secondary",
};

export function TeamManager({ initial }: { initial: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [open, setOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("constituency_coordinator");
  const [regionCode, setRegionCode] = useState(REAL_HIERARCHY[0].code);
  const [conCode, setConCode] = useState(REAL_HIERARCHY[0].constituencies[0].code);

  const region = useMemo(() => REAL_HIERARCHY.find((r) => r.code === regionCode)!, [regionCode]);

  const needsRegion = role === "regional_coordinator" || role === "constituency_coordinator";
  const needsConstituency = role === "constituency_coordinator";

  function scopeLabel(): string {
    if (role === "super_admin") return "National";
    if (role === "analyst") return "National (read-only)";
    if (role === "regional_coordinator") return region.name;
    const con = region.constituencies.find((c) => c.code === conCode);
    return `${region.name} · ${con?.name ?? ""}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    // POST /assignments + invite — persisted once the API is connected (Section 12).
    setMembers((m) => [
      { userId: `u-${Date.now()}`, fullName: fullName.trim(), email: email.trim(), role, scope: scopeLabel(), isActive: true },
      ...m,
    ]);
    setFullName("");
    setEmail("");
    setOpen(false);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? <X /> : <UserPlus />}
          {open ? "Cancel" : "Create member"}
        </Button>
      </div>

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
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ndc.org" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
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
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.constituencies.length})
                    </option>
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
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end justify-between gap-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                Assigning scope: <span className="font-medium text-foreground">{scopeLabel()}</span>
              </p>
              <Button type="submit">Create &amp; assign</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>
                  <div className="font-medium text-foreground">{m.fullName}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{m.scope}</TableCell>
                <TableCell>
                  {m.isActive ? <Badge variant="green">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

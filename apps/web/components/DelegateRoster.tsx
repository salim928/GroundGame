"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Loader2, Pencil, Phone, Plus, Search, Trash2, X } from "lucide-react";
import type { DelegateCall, RealDelegate } from "@/lib/delegates.server";
import { getAccessToken } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { canEditDelegates } from "@/lib/access";
import { Card, Pill } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/export";

interface Row extends RealDelegate {
  rowId: string; // DB uuid for saved rows, or a temp id for unsaved ones
  saved: boolean; // backed by a Supabase row
}

const POSITIONS = [
  "Chairman", "Vice Chairman", "Secretary", "Deputy Secretary", "Treasurer", "Deputy Treasurer",
  "Organizer", "Deputy Organizer", "Communications Officer", "Deputy Communications Officer",
  "Women's Organizer", "Deputy Women's Organizer", "Youth Organizer", "Deputy Youth Organizer",
  "Nasara Coordinator", "Deputy Nasara Coordinator", "Council of Elders",
];

const OUTCOME_PILL: Record<string, { tone: "green" | "amber" | "red" | "slate"; label: string }> = {
  supportive: { tone: "green", label: "Supportive" },
  undecided: { tone: "amber", label: "Undecided" },
  hostile: { tone: "red", label: "Opposed" },
  wrong_number: { tone: "slate", label: "Wrong number" },
};

function CallStatus({ call }: { call?: DelegateCall }) {
  if (!call || !call.called) return <span className="text-xs text-slate-400">Not called</span>;
  if (!call.reached) return <Pill tone="amber">No answer</Pill>;
  if (call.outcome && OUTCOME_PILL[call.outcome]) {
    const o = OUTCOME_PILL[call.outcome];
    return <Pill tone={o.tone}>{o.label}</Pill>;
  }
  return <Pill tone="slate">Reached</Pill>;
}

export function DelegateRoster({
  constituency,
  constituencyCode,
  initial,
  calls = {},
}: {
  constituency: string;
  constituencyCode: string;
  initial: RealDelegate[];
  calls?: Record<string, DelegateCall>;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((d, i) => ({ ...d, rowId: d.id ?? `local-${i}`, saved: Boolean(d.id) })),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    setCanEdit(canEditDelegates(getSession()?.role));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.name.toLowerCase().includes(t) || r.position.toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  async function api(method: string, body?: unknown, query = "") {
    const token = await getAccessToken();
    const res = await fetch(`/api/delegates${query}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
    return res.json().catch(() => ({}));
  }

  function startEdit(r: Row) {
    setError("");
    setEditing(r.rowId);
    setDraft({ ...r });
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (draft.saved) {
        await api("PATCH", { id: draft.rowId, name: draft.name, position: draft.position, contact: draft.contact });
        setRows((rs) => rs.map((r) => (r.rowId === draft.rowId ? { ...draft } : r)));
      } else {
        const out = await api("POST", {
          constituencyCode,
          name: draft.name,
          position: draft.position,
          contact: draft.contact,
        });
        const newId = (out.id as string) ?? draft.rowId;
        setRows((rs) => rs.map((r) => (r.rowId === draft.rowId ? { ...draft, rowId: newId, saved: true } : r)));
      }
      setEditing(null);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
    setBusy(false);
  }

  function cancel() {
    setRows((rs) => rs.filter((r) => r.saved || r.name || r.position));
    setEditing(null);
    setDraft(null);
    setError("");
  }

  async function remove(r: Row) {
    setError("");
    if (r.saved) {
      try {
        await api("DELETE", undefined, `?id=${r.rowId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete");
        return;
      }
    }
    setRows((rs) => rs.filter((x) => x.rowId !== r.rowId));
  }

  function add() {
    const rowId = `new-${Date.now()}`;
    const blank: Row = { rowId, saved: false, position: "", name: "", contact: "" };
    setRows((rs) => [...rs, blank]);
    setEditing(rowId);
    setDraft(blank);
  }

  function exportCsv() {
    downloadCsv(
      `${constituency.toLowerCase().replace(/\s+/g, "-")}-executives`,
      rows.map((r) => ({ Position: r.position, Name: r.name, Contact: r.contact ?? "" })),
    );
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="font-semibold text-foreground">Constituency executives</h2>
          <p className="text-xs text-muted-foreground">{rows.length} members · name, position &amp; contact</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 w-40 pl-8" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> CSV
          </Button>
          {canEdit && (
            <Button size="sm" onClick={add}>
              <Plus /> Add
            </Button>
          )}
        </div>
      </div>

      {error && <p className="px-5 pb-2 text-sm text-rose-600">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Call status</TableHead>
            {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) =>
            editing === r.rowId && draft ? (
              <TableRow key={r.rowId} className="bg-muted/40">
                <TableCell>
                  <select
                    value={draft.position}
                    onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                  >
                    <option value="">— position —</option>
                    {POSITIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Full name"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={draft.contact ?? ""}
                    onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                    placeholder="0XXXXXXXXX"
                    className="h-8"
                  />
                </TableCell>
                <TableCell><CallStatus call={calls[r.rowId]} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={save} disabled={busy} className="rounded p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40" title="Save">
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    </button>
                    <button onClick={cancel} disabled={busy} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40" title="Cancel">
                      <X size={15} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={r.rowId}>
                <TableCell className="font-medium text-foreground">{r.position || "—"}</TableCell>
                <TableCell>{r.name || "—"}</TableCell>
                <TableCell className="tnum text-muted-foreground">
                  {r.contact ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} className="text-primary" />
                      {r.contact}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell><CallStatus call={calls[r.rowId]} /></TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => startEdit(r)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(r)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ),
          )}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No executives recorded yet. Use <span className="font-medium text-foreground">Add</span> to create one.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {canEdit && (
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Changes save to the database for coordinators with access to this constituency.
        </p>
      )}
    </Card>
  );
}

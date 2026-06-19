"use client";

import { useMemo, useState } from "react";
import { Check, Download, Pencil, Phone, Plus, Search, Trash2, X } from "lucide-react";
import type { RealDelegate } from "@/lib/delegates.server";
import { Card } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/export";

interface Row extends RealDelegate {
  id: string;
}

const POSITIONS = [
  "Chairman", "Vice Chairman", "Secretary", "Deputy Secretary", "Treasurer", "Deputy Treasurer",
  "Organizer", "Deputy Organizer", "Communications Officer", "Deputy Communications Officer",
  "Women's Organizer", "Deputy Women's Organizer", "Youth Organizer", "Deputy Youth Organizer",
  "Nasara Coordinator", "Deputy Nasara Coordinator", "Council of Elders",
];

export function DelegateRoster({
  constituency,
  initial,
}: {
  constituency: string;
  initial: RealDelegate[];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map((d, i) => ({ ...d, id: `d${i}` })));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.name.toLowerCase().includes(t) || r.position.toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  function startEdit(r: Row) {
    setEditing(r.id);
    setDraft({ ...r });
  }
  function save() {
    if (!draft) return;
    setRows((rs) => (rs.some((r) => r.id === draft.id) ? rs.map((r) => (r.id === draft.id ? draft : r)) : [...rs, draft]));
    setEditing(null);
    setDraft(null);
  }
  function cancel() {
    setRows((rs) => rs.filter((r) => r.name || r.position)); // drop empty new row
    setEditing(null);
    setDraft(null);
  }
  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }
  function add() {
    const id = `new-${Date.now()}`;
    const blank: Row = { id, position: "", name: "", contact: "" };
    setRows((rs) => [...rs, blank]);
    setEditing(id);
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
          <Button size="sm" onClick={add}>
            <Plus /> Add
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) =>
            editing === r.id && draft ? (
              <TableRow key={r.id} className="bg-muted/40">
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={save} className="rounded p-1.5 text-primary hover:bg-primary/10" title="Save">
                      <Check size={15} />
                    </button>
                    <button onClick={cancel} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Cancel">
                      <X size={15} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={r.id}>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(r)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remove(r.id)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ),
          )}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No executives recorded yet. Use <span className="font-medium text-foreground">Add</span> to create one.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="px-5 py-3 text-xs text-muted-foreground">
        Edits are local in this demo. Connecting the API persists changes to the database and writes back to the Sheet.
      </p>
    </Card>
  );
}

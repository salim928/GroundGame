"use client";

import { useState } from "react";
import { FileSpreadsheet, Info, UploadCloud } from "lucide-react";
import { Card } from "@/components/primitives";

interface CurrentRoster {
  regions: number;
  constituencies: number;
  delegates: number;
}

export function UploadFlow({ current }: { current: CurrentRoster }) {
  const [file, setFile] = useState<File | null>(null);

  const rows: [string, number][] = [
    ["Regions", current.regions],
    ["Constituencies", current.constituencies],
    ["Delegates", current.delegates],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-semibold text-ink">Current master list</h2>
        <p className="mb-4 text-sm text-muted-foreground">Live counts from the roster in Supabase.</p>
        <dl className="grid grid-cols-3 gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="tnum text-2xl font-semibold text-ink">{value.toLocaleString()}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        {file ? (
          <div className="flex flex-col items-center py-10 text-center">
            <FileSpreadsheet className="mb-3 text-accent" size={32} />
            <p className="font-medium text-ink">{file.name}</p>
            <p className="tnum mt-1 text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB selected</p>
            <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Server-side parsing &amp; upsert runs through the import service, which isn&apos;t connected in this
                deployment. The roster is currently maintained directly in Supabase.
              </span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-muted"
            >
              Choose another file
            </button>
          </div>
        ) : (
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center transition hover:border-accent hover:bg-accent/5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <UploadCloud size={36} className="mb-3 text-slate-400" />
            <p className="font-medium text-ink">Drop your Excel/CSV here</p>
            <p className="mt-1 text-sm text-slate-400">or click to browse · grouped region → constituency → branch</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </label>
        )}
      </Card>
    </div>
  );
}

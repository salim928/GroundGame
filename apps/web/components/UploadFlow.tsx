"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import type { UploadPreview } from "@/lib/types";
import { Card } from "@/components/primitives";

// Mock parse result — the real flow POSTs to /uploads/delegates for a server-side preview (Section 12).
const SAMPLE_PREVIEW: UploadPreview = {
  regions: 5,
  constituencies: 34,
  branches: 198,
  delegates: 372,
  duplicates: 4,
  newDelegates: 358,
  updatedDelegates: 14,
};

export function UploadFlow() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");

  if (step === "done") {
    return (
      <Card className="flex flex-col items-center py-16 text-center">
        <CheckCircle2 className="mb-3 text-emerald-500" size={36} />
        <p className="text-lg font-medium text-ink">Master list committed</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Hierarchy and delegates upserted with stable <code>external_ref</code>s. One Google Sheet per
          constituency is being provisioned with the locked layout.
        </p>
        <button
          onClick={() => {
            setStep("upload");
            setFileName("");
          }}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Import another file
        </button>
      </Card>
    );
  }

  if (step === "preview") {
    const rows: [string, number][] = [
      ["Regions", SAMPLE_PREVIEW.regions],
      ["Constituencies", SAMPLE_PREVIEW.constituencies],
      ["Branches", SAMPLE_PREVIEW.branches],
      ["Delegates", SAMPLE_PREVIEW.delegates],
      ["New delegates", SAMPLE_PREVIEW.newDelegates],
      ["Updated (existing call data preserved)", SAMPLE_PREVIEW.updatedDelegates],
      ["Duplicates flagged", SAMPLE_PREVIEW.duplicates],
    ];
    return (
      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <FileSpreadsheet size={16} className="text-accent" /> {fileName || "master_list.xlsx"}
        </div>
        <h2 className="mb-3 font-semibold text-ink">Parsed preview</h2>
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-slate-600">{label}</dt>
              <dd className="tnum font-medium text-ink">{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setStep("done")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Approve & commit
          </button>
          <button
            onClick={() => setStep("upload")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-muted"
          >
            Discard
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center transition hover:border-accent hover:bg-accent/5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) {
            setFileName(f.name);
            setStep("preview");
          }
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
            if (f) {
              setFileName(f.name);
              setStep("preview");
            }
          }}
        />
      </label>
    </Card>
  );
}

import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { SheetsService } from "../sheets/sheets.service";

// Sheet column indices (0-based) for the Section 8.1 layout (A..Q).
const COL = {
  ref: 0,
  called: 6,
  reached: 7,
  supportive: 8,
  undecided: 9,
  opposed: 10,
  wrongNumber: 11,
  callback: 12,
  notes: 14,
} as const;

const truthy = (v: string | undefined) => v === "TRUE" || v === "true" || v === "✔" || v === "1";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly supabase: SupabaseService, private readonly sheets: SheetsService) {}

  /** Full pull + reconcile for every sync-enabled constituency (Section 8.2). */
  async runAll(): Promise<{ constituencies: number; conflicts: number }> {
    const { data: cons } = await this.supabase.client
      .from("constituencies")
      .select("id, name, sheet_id")
      .eq("sync_enabled", true)
      .not("sheet_id", "is", null);

    let conflicts = 0;
    for (const c of cons ?? []) {
      try {
        // One failing sheet logs its error and retries next cycle without stopping the run (Section 8.3).
        const res = await this.reconcile(c.id, c.sheet_id as string);
        conflicts += res.conflicts;
      } catch (err) {
        this.logger.error(`Sync failed for ${c.name}: ${(err as Error).message}`);
        await this.recordRun(c.id, "failed", 0, 0, 0, (err as Error).message);
      }
    }
    return { constituencies: (cons ?? []).length, conflicts };
  }

  /** Reconcile a single constituency Sheet into call_records (Section 8.2 steps 1–7). */
  async reconcile(constituencyId: string, sheetId: string) {
    const startedAt = new Date().toISOString();
    const rows = await this.sheets.pull(sheetId);
    let written = 0;
    let conflicts = 0;
    const writeBack: { row: number; status: string; lastSynced: string }[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sheetRow = i + 2; // data starts at row 2
      const externalRef = row[COL.ref];
      if (!externalRef) continue;

      const { data: delegate } = await this.supabase.client
        .from("delegates")
        .select("id")
        .eq("external_ref", externalRef)
        .single();
      if (!delegate) continue;

      // Validate mutual exclusivity of I/J/K — ≥2 ticked raises a conflict (Section 8.2 step 4).
      const ticked = [
        truthy(row[COL.supportive]) && "Supportive",
        truthy(row[COL.undecided]) && "Undecided",
        truthy(row[COL.opposed]) && "Opposed",
      ].filter(Boolean) as string[];

      if (ticked.length >= 2) {
        conflicts++;
        await this.openConflict(delegate.id, ticked);
        writeBack.push({ row: sheetRow, status: "CONFLICT", lastSynced: now });
        continue; // leave stored outcome unchanged; never guess
      }

      const reached = truthy(row[COL.reached]);
      const outcome = truthy(row[COL.supportive])
        ? "supportive"
        : truthy(row[COL.opposed])
          ? "hostile"
          : truthy(row[COL.wrongNumber])
            ? "wrong_number"
            : truthy(row[COL.undecided])
              ? "undecided"
              : null;

      // Upsert clean rows keyed on delegate_id; idempotent (Section 8.3).
      await this.supabase.client.from("call_records").upsert(
        {
          delegate_id: delegate.id,
          called: truthy(row[COL.called]),
          reached,
          outcome,
          notes: row[COL.notes] || null,
          source: "sheet",
          contacted_at: truthy(row[COL.called]) ? now : null,
          updated_at: now,
        },
        { onConflict: "delegate_id" },
      );
      written++;
      writeBack.push({ row: sheetRow, status: "OK", lastSynced: now });
    }

    await this.sheets.writeBackStatus(sheetId, writeBack);
    await this.recordRun(constituencyId, "success", rows.length, written, conflicts, null, startedAt);
    return { pulled: rows.length, written, conflicts };
  }

  private async openConflict(delegateId: string, flags: string[]) {
    // Avoid duplicate open conflicts for the same delegate.
    const { data: existing } = await this.supabase.client
      .from("conflicts")
      .select("id")
      .eq("delegate_id", delegateId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return;
    await this.supabase.client.from("conflicts").insert({
      delegate_id: delegateId,
      raw_flags: flags,
      status: "open",
    });
  }

  private async recordRun(
    constituencyId: string,
    status: string,
    pulled: number,
    written: number,
    conflicts: number,
    error: string | null,
    startedAt?: string,
  ) {
    await this.supabase.client.from("sync_runs").insert({
      constituency_id: constituencyId,
      started_at: startedAt ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
      status,
      rows_pulled: pulled,
      rows_written: written,
      conflicts_found: conflicts,
      error,
    });
  }

  async lastRuns() {
    const { data } = await this.supabase.client
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    return data ?? [];
  }
}

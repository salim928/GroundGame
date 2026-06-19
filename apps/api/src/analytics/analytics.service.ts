import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { AuthUser } from "../auth/auth.guard";
import { regionFilter } from "../rbac/scope";
import {
  addSpine,
  bucket,
  classify,
  DEFAULT_WEIGHTS,
  emptySpine,
  projectShare,
  Spine,
  spineTotal,
  Weights,
} from "./projection";

interface DelegateCallRow {
  constituency_id: string;
  call_records: { reached: boolean; called: boolean; outcome: any } | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly supabase: SupabaseService) {}

  private async weights(): Promise<Weights> {
    const { data } = await this.supabase.client
      .from("app_config")
      .select("value")
      .eq("key", "projection_weights")
      .single();
    return (data?.value as Weights) ?? DEFAULT_WEIGHTS;
  }

  /** National overview rollup with per-region spines (Section 10 Overview). */
  async overview(user: AuthUser) {
    const weights = await this.weights();
    const { data: regions } = await this.supabase.client.from("regions").select("id, name, code");
    const regionRollups: Array<Record<string, unknown>> = [];
    let national = emptySpine();
    let called = 0;
    let delegates = 0;

    for (const region of regions ?? []) {
      if (regionFilter(user) && regionFilter(user) !== region.id) continue;
      const spine = await this.regionSpine(region.id);
      national = addSpine(national, spine.spine);
      called += spine.called;
      delegates += spine.total;
      const share = projectShare(spine.spine, weights);
      regionRollups.push({
        id: region.id,
        name: region.name,
        code: region.code,
        spine: spine.spine,
        kpis: this.kpis(spine.spine, spine.called),
        constituencies: spine.constituencies,
        classification: classify(share),
      });
    }

    return {
      kpis: this.kpis(national, called),
      spine: national,
      regions: regionRollups,
      dailyReached: [],
      alerts: await this.alerts(),
      segments: [],
    };
  }

  private kpis(spine: Spine, called: number) {
    const delegates = spineTotal(spine);
    const reached = spine.supportive + spine.undecided + spine.opposed;
    return {
      delegates,
      called,
      reached,
      coverage: delegates ? called / delegates : 0,
      projectedSupport: projectShare(spine),
    };
  }

  private async regionSpine(regionId: string) {
    const { data } = await this.supabase.client
      .from("delegates")
      .select("constituency_id, call_records(reached, called, outcome), constituencies!inner(region_id)")
      .eq("constituencies.region_id", regionId)
      .eq("is_active", true);

    let spine = emptySpine();
    let called = 0;
    const constituencies = new Set<string>();
    for (const row of (data ?? []) as any[]) {
      constituencies.add(row.constituency_id);
      const cr = row.call_records;
      if (cr?.called) called++;
      spine = bucket(spine, !!cr?.reached, cr?.outcome ?? null);
    }
    return { spine, called, total: (data ?? []).length, constituencies: constituencies.size };
  }

  /** Open alerts surfaced on the Overview (Section 11 Alerts & reporting). */
  private async alerts() {
    const { count } = await this.supabase.client
      .from("conflicts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    const out: { id: string; kind: string; severity: string; message: string }[] = [];
    if (count) {
      out.push({
        id: "pending_conflicts",
        kind: "pending_conflicts",
        severity: "critical",
        message: `${count} outcome conflicts awaiting review`,
      });
    }
    return out;
  }
}

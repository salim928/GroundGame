import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { AuthUser } from "../auth/auth.guard";
import { regionFilter } from "../rbac/scope";

@Injectable()
export class HierarchyService {
  constructor(private readonly supabase: SupabaseService) {}

  regions() {
    return this.supabase.client.from("regions").select("*").order("name").then((r) => r.data ?? []);
  }

  async constituencies(user: AuthUser, regionId?: string) {
    let q = this.supabase.client.from("constituencies").select("*").order("name");
    const scoped = regionFilter(user) ?? regionId;
    if (scoped) q = q.eq("region_id", scoped);
    if (user.role === "constituency_coordinator" && user.constituencyId) q = q.eq("id", user.constituencyId);
    const { data } = await q;
    return data ?? [];
  }

  async branches(constituencyId: string) {
    const { data } = await this.supabase.client
      .from("branches")
      .select("*")
      .eq("constituency_id", constituencyId)
      .order("name");
    return data ?? [];
  }
}

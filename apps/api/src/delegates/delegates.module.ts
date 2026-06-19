import { Controller, Get, Module, Param, Query } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";
import { assertCanSeeConstituency } from "../rbac/scope";

@Controller("delegates")
class DelegatesController {
  constructor(private readonly supabase: SupabaseService) {}

  // GET /delegates?constituencyId= — scoped delegate list with call status (Section 12).
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query("constituencyId") constituencyId: string) {
    const { data: c } = await this.supabase.client
      .from("constituencies")
      .select("id, region_id")
      .eq("id", constituencyId)
      .single();
    assertCanSeeConstituency(user, c?.region_id ?? null, constituencyId);

    const { data } = await this.supabase.client
      .from("delegates")
      .select("*, call_records(*), branches(name)")
      .eq("constituency_id", constituencyId)
      .eq("is_active", true);
    return data ?? [];
  }
}

@Module({
  controllers: [DelegatesController],
})
export class DelegatesModule {}

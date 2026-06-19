import { Body, Controller, Get, Module, Param, Post } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { Roles } from "../rbac/roles.guard";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";

interface ResolveDto {
  outcome: "supportive" | "undecided" | "hostile" | "wrong_number";
}

@Controller("conflicts")
class ConflictsController {
  constructor(private readonly supabase: SupabaseService) {}

  // GET /conflicts — open review queue (Section 12).
  @Get()
  @Roles("super_admin", "regional_coordinator", "constituency_coordinator")
  async list() {
    const { data } = await this.supabase.client
      .from("conflicts")
      .select("*, delegates(full_name, constituency_id, branches(name))")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    return data ?? [];
  }

  // POST /conflicts/:id/resolve — set the true outcome and clear Sheet CONFLICT status (Section 12, MVP #6).
  @Post(":id/resolve")
  @Roles("super_admin", "regional_coordinator", "constituency_coordinator")
  async resolve(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: ResolveDto) {
    const { data: conflict } = await this.supabase.client
      .from("conflicts")
      .select("delegate_id")
      .eq("id", id)
      .single();
    if (!conflict) return { ok: false, error: "not_found" };

    await this.supabase.client
      .from("call_records")
      .update({ outcome: body.outcome, source: "app", updated_at: new Date().toISOString() })
      .eq("delegate_id", conflict.delegate_id);

    await this.supabase.client
      .from("conflicts")
      .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", id);

    await this.supabase.client.from("audit_logs").insert({
      actor: user.id,
      action: "conflict.resolve",
      entity: "conflict",
      entity_id: id,
      meta: { outcome: body.outcome },
    });

    // The sync worker writes the cleared status back to the Sheet on the next cycle.
    return { ok: true };
  }
}

@Module({
  controllers: [ConflictsController],
})
export class ConflictsModule {}

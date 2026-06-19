import { Body, Controller, Module, Post } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { SheetsService } from "../sheets/sheets.service";
import { Roles } from "../rbac/roles.guard";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";
import { assertCanSeeConstituency } from "../rbac/scope";

interface AssignDto {
  constituencyId: string;
  callerEmail: string;
  userId?: string;
}

@Controller("assignments")
class AssignmentsController {
  constructor(private readonly supabase: SupabaseService, private readonly sheets: SheetsService) {}

  // POST /assignments — assign caller + share Sheet via Drive (Section 12, MVP #3).
  @Post()
  @Roles("super_admin", "regional_coordinator", "constituency_coordinator")
  async assign(@CurrentUser() user: AuthUser, @Body() body: AssignDto) {
    const { data: c } = await this.supabase.client
      .from("constituencies")
      .select("id, region_id, sheet_id, name")
      .eq("id", body.constituencyId)
      .single();
    if (!c) return { ok: false, error: "constituency_not_found" };
    assertCanSeeConstituency(user, c.region_id, c.id);

    let sheetShared = false;
    if (c.sheet_id) {
      await this.sheets.shareWithCaller(c.sheet_id, body.callerEmail);
      sheetShared = true;
    }

    const { data: assignment } = await this.supabase.client
      .from("assignments")
      .insert({
        user_id: body.userId ?? null,
        scope_type: "constituency",
        scope_id: c.id,
        sheet_shared: sheetShared,
        invited_email: body.callerEmail,
      })
      .select()
      .single();

    await this.supabase.client.from("audit_logs").insert({
      actor: user.id,
      action: "assignment.create",
      entity: "constituency",
      entity_id: c.id,
      meta: { callerEmail: body.callerEmail, sheetShared },
    });

    return { ok: true, assignment };
  }
}

@Module({
  controllers: [AssignmentsController],
})
export class AssignmentsModule {}

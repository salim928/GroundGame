import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { Roles } from "../rbac/roles.guard";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";

// app_config — projection weights & classification thresholds, editable without redeploy
// (Section 3.2 / MVP #10). Writes are Super Admin only; reads are open to dashboard users.
@Controller("config")
export class ConfigController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async all() {
    const { data } = await this.supabase.client.from("app_config").select("*");
    return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  }

  @Put(":key")
  @Roles("super_admin")
  async set(@CurrentUser() user: AuthUser, @Param("key") key: string, @Body() value: unknown) {
    await this.supabase.client.from("app_config").upsert({ key, value }).eq("key", key);
    await this.supabase.client.from("audit_logs").insert({
      actor: user.id,
      action: "config.update",
      entity: "app_config",
      entity_id: key,
      meta: { value },
    });
    return { ok: true };
  }
}

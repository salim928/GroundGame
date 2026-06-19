import { Controller, Get, Module } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { Roles } from "../rbac/roles.guard";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";
import { regionFilter } from "../rbac/scope";

@Controller("users")
class UsersController {
  constructor(private readonly supabase: SupabaseService) {}

  // Team & roles list (Section 10 Team & roles). Super Admin sees all; Regional is scoped.
  @Get()
  @Roles("super_admin", "regional_coordinator")
  async list(@CurrentUser() user: AuthUser) {
    let q = this.supabase.client.from("profiles").select("*").order("full_name");
    const scoped = regionFilter(user);
    if (scoped) q = q.eq("region_id", scoped);
    const { data } = await q;
    return data ?? [];
  }
}

@Module({
  controllers: [UsersController],
})
export class UsersModule {}

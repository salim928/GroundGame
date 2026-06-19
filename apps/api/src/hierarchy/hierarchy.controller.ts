import { Controller, Get, Param, Query } from "@nestjs/common";
import { HierarchyService } from "./hierarchy.service";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";

// GET /regions /constituencies /branches — scoped hierarchy reads (Section 12)
@Controller()
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  @Get("regions")
  regions() {
    return this.hierarchy.regions();
  }

  @Get("constituencies")
  constituencies(@CurrentUser() user: AuthUser, @Query("regionId") regionId?: string) {
    return this.hierarchy.constituencies(user, regionId);
  }

  @Get("branches")
  branches(@Query("constituencyId") constituencyId: string) {
    return this.hierarchy.branches(constituencyId);
  }
}

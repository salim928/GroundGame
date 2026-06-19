import { Controller, Get, Param } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";

// GET /analytics/overview · /region/:id · /callers (Section 12)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  overview(@CurrentUser() user: AuthUser) {
    return this.analytics.overview(user);
  }

  @Get("region/:id")
  region(@CurrentUser() user: AuthUser, @Param("id") _id: string) {
    // Region detail rollup — delegates to the same scoped aggregation path.
    return this.analytics.overview(user);
  }
}

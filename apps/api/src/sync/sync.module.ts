import { Controller, Get, Module, Post } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { Roles } from "../rbac/roles.guard";

// POST /sync/run · GET /sync/status — manual sync + run results (Section 12).
@Controller("sync")
class SyncController {
  constructor(private readonly sync: SyncService) {}

  // Super Admin can force an immediate sync of all sheets (Section 8.3).
  @Post("run")
  @Roles("super_admin")
  run() {
    return this.sync.runAll();
  }

  @Get("status")
  @Roles("super_admin", "regional_coordinator", "constituency_coordinator", "analyst")
  status() {
    return this.sync.lastRuns();
  }
}

@Module({
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

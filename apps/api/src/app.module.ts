import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { SupabaseModule } from "./supabase/supabase.module";
import { SheetsModule } from "./sheets/sheets.module";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./rbac/roles.guard";
import { HierarchyModule } from "./hierarchy/hierarchy.module";
import { DelegatesModule } from "./delegates/delegates.module";
import { UploadsModule } from "./uploads/uploads.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { ConflictsModule } from "./conflicts/conflicts.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SyncModule } from "./sync/sync.module";
import { ConfigController } from "./config/config.controller";
import { UsersModule } from "./users/users.module";

// NestJS modules per Build Spec Section 13.1:
// auth · rbac · users · hierarchy · delegates · uploads
// sheets · sync · conflicts · analytics · reports · audit · config
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    SheetsModule,
    UsersModule,
    HierarchyModule,
    DelegatesModule,
    UploadsModule,
    AssignmentsModule,
    ConflictsModule,
    AnalyticsModule,
    SyncModule,
  ],
  controllers: [ConfigController],
  providers: [
    // Two-layer enforcement: AuthGuard (JWT) then RolesGuard (RBAC + scope). Section 8.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

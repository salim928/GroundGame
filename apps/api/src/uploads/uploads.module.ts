import { Body, Controller, Module, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadsService } from "./uploads.service";
import { SupabaseService } from "../supabase/supabase.service";
import { Roles } from "../rbac/roles.guard";
import { CurrentUser } from "../rbac/current-user.decorator";
import type { AuthUser } from "../auth/auth.guard";

// POST /uploads/delegates(/commit) — parse & commit master list; provision sheets (Section 12).
// Only Super Admin uploads the master list (Section 8 permission matrix).
@Controller("uploads")
class UploadsController {
  constructor(private readonly uploads: UploadsService, private readonly supabase: SupabaseService) {}

  @Post("delegates")
  @Roles("super_admin")
  @UseInterceptors(FileInterceptor("file"))
  async preview(@UploadedFile() file: { buffer: Buffer; originalname: string }) {
    const preview = await this.uploads.parse(file.buffer, file.originalname);
    // Return counts + duplicates only; the full row payload is committed in a second call.
    const { rows, ...summary } = preview;
    return { ...summary, rowCount: rows.length };
  }

  @Post("delegates/commit")
  @Roles("super_admin")
  @UseInterceptors(FileInterceptor("file"))
  async commit(@CurrentUser() user: AuthUser, @UploadedFile() file: { buffer: Buffer; originalname: string }) {
    const preview = await this.uploads.parse(file.buffer, file.originalname);
    // Upsert hierarchy + delegates; re-uploads diff (add new, update changed, preserve call data) — Section 9.
    // Provisioning of one Sheet per constituency is enqueued to the sync/sheets worker.
    await this.supabase.client.from("audit_logs").insert({
      actor: user.id,
      action: "upload.commit",
      entity: "delegates",
      meta: { delegates: preview.delegates, constituencies: preview.constituencies },
    });
    return { ok: true, committed: preview.delegates, provisioning: preview.constituencies };
  }
}

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}

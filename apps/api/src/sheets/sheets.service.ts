import { Injectable, Logger } from "@nestjs/common";
import { google, sheets_v4, drive_v3 } from "googleapis";

/**
 * Sole Google client (Section 4). Wraps Sheets API v4 + Drive API v3 via the service account.
 * Per-constituency Sheet layout and conflict rule are defined in Section 8.1.
 */
@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private sheets?: sheets_v4.Sheets;
  private drive?: drive_v3.Drive;

  private auth() {
    const b64 = process.env.GOOGLE_SA_KEY_BASE64;
    if (!b64) {
      this.logger.warn("GOOGLE_SA_KEY_BASE64 not set — Sheets/Drive calls disabled.");
      return null;
    }
    const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    });
  }

  private async clients() {
    if (this.sheets && this.drive) return { sheets: this.sheets, drive: this.drive };
    const auth = this.auth();
    if (!auth) return null;
    this.sheets = google.sheets({ version: "v4", auth });
    this.drive = google.drive({ version: "v3", auth });
    return { sheets: this.sheets, drive: this.drive };
  }

  // Column layout — Section 8.1 (A Ref … P/Q Status, Last Synced).
  static readonly HEADERS = [
    "Ref", "Branch", "Name", "Type", "Phone", "Assigned Caller",
    "Called", "Reached", "Supportive", "Undecided", "Opposed",
    "Wrong Number", "Callback?", "Influencer", "Notes", "Status", "Last Synced",
  ];

  /** Pull all rows for a constituency Sheet (batchGet). */
  async pull(sheetId: string): Promise<string[][]> {
    const c = await this.clients();
    if (!c) return [];
    const res = await c.sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "A2:Q" });
    return (res.data.values as string[][]) ?? [];
  }

  /** Write back Assigned Caller, Status, Last Synced (batchUpdate) — Section 8.2 step 6. */
  async writeBackStatus(sheetId: string, updates: { row: number; status: string; lastSynced: string }[]) {
    const c = await this.clients();
    if (!c) return;
    const data = updates.map((u) => ({
      range: `P${u.row}:Q${u.row}`,
      values: [[u.status, u.lastSynced]],
    }));
    await c.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }

  /** Create one Sheet per constituency in the Shared Drive with the locked header (Section 9). */
  async provision(constituencyName: string): Promise<string | null> {
    const c = await this.clients();
    if (!c) return null;
    const created = await c.drive.files.create({
      requestBody: {
        name: `GroundGame — ${constituencyName}`,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: process.env.GOOGLE_SHARED_DRIVE_ID ? [process.env.GOOGLE_SHARED_DRIVE_ID] : undefined,
      },
      supportsAllDrives: true,
      fields: "id",
    });
    const sheetId = created.data.id!;
    await c.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "A1:Q1",
      valueInputOption: "RAW",
      requestBody: { values: [SheetsService.HEADERS] },
    });
    return sheetId;
  }

  /** Grant a caller's Google email Editor access to a single Sheet (Section 9). */
  async shareWithCaller(sheetId: string, email: string) {
    const c = await this.clients();
    if (!c) return;
    await c.drive.permissions.create({
      fileId: sheetId,
      supportsAllDrives: true,
      requestBody: { type: "user", role: "writer", emailAddress: email },
    });
  }
}

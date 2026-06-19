import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import Papa from "papaparse";
import { randomUUID } from "crypto";

export interface ParsedRow {
  region: string;
  constituency: string;
  branch: string;
  fullName: string;
  phone?: string;
  delegateType?: string;
  position?: string;
}

export interface UploadPreview {
  regions: number;
  constituencies: number;
  branches: number;
  delegates: number;
  duplicates: number;
  rows: ParsedRow[];
}

/**
 * Parse + validate the master Excel/CSV grouped region → constituency → branch → delegate (Section 9).
 * A stable external_ref is generated per delegate at commit (Section 6.1).
 */
@Injectable()
export class UploadsService {
  async parse(buffer: Buffer, filename: string): Promise<UploadPreview> {
    const rows = filename.toLowerCase().endsWith(".csv")
      ? this.parseCsv(buffer)
      : await this.parseXlsx(buffer);
    return this.summarise(rows);
  }

  private parseCsv(buffer: Buffer): ParsedRow[] {
    const text = buffer.toString("utf8");
    const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    return data.map((r) => this.normalise(r));
  }

  private async parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    const headers: string[] = [];
    const out: ParsedRow[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) {
        row.eachCell((cell, col) => (headers[col] = String(cell.value ?? "").trim().toLowerCase()));
        return;
      }
      const rec: Record<string, string> = {};
      row.eachCell((cell, col) => (rec[headers[col]] = String(cell.value ?? "").trim()));
      out.push(this.normalise(rec));
    });
    return out;
  }

  private normalise(r: Record<string, string>): ParsedRow {
    const get = (...keys: string[]) => keys.map((k) => r[k]).find(Boolean) ?? "";
    return {
      region: get("region"),
      constituency: get("constituency"),
      branch: get("branch"),
      fullName: get("name", "full_name", "fullname"),
      phone: get("phone", "phone_number"),
      delegateType: get("type", "delegate_type"),
      position: get("position"),
    };
  }

  private summarise(rows: ParsedRow[]): UploadPreview {
    const valid = rows.filter((r) => r.fullName && r.constituency);
    const regions = new Set(valid.map((r) => r.region));
    const constituencies = new Set(valid.map((r) => `${r.region}/${r.constituency}`));
    const branches = new Set(valid.map((r) => `${r.region}/${r.constituency}/${r.branch}`));
    const seen = new Set<string>();
    let duplicates = 0;
    for (const r of valid) {
      const key = `${r.constituency}/${r.fullName}/${r.phone}`;
      if (seen.has(key)) duplicates++;
      seen.add(key);
    }
    return {
      regions: regions.size,
      constituencies: constituencies.size,
      branches: branches.size,
      delegates: valid.length,
      duplicates,
      rows: valid,
    };
  }

  /** external_ref is the immutable Sheet join key (Section 6.1). */
  generateExternalRef(constituencyCode: string, index: number): string {
    return `${constituencyCode}-${String(index).padStart(4, "0")}-${randomUUID().slice(0, 6)}`;
  }
}

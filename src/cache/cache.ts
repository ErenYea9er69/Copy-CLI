import { promises as fs } from "node:fs";
import path from "node:path";
import type { RewriteResult } from "../extract/types.js";

export const REPORT_DIR = ".copyshed";

export interface StoredResult extends RewriteResult {
  decision: "pending" | "accepted" | "skipped";
}

export interface Report {
  createdAt: string;
  results: StoredResult[];
}

export async function ensureReportDir(): Promise<string> {
  const dir = path.resolve(process.cwd(), REPORT_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeReport(results: RewriteResult[], decisions?: Map<string, "accepted" | "skipped">): Promise<string> {
  const dir = await ensureReportDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `report-${stamp}.json`);
  const report: Report = {
    createdAt: new Date().toISOString(),
    results: results.map((r) => ({
      ...r,
      decision: decisions?.get(r.candidate.id) ?? (r.status === "ok" ? "pending" : "pending"),
    })),
  };
  await fs.writeFile(file, JSON.stringify(report, null, 2), "utf8");
  const latest = path.join(dir, "latest.json");
  await fs.writeFile(latest, JSON.stringify(report, null, 2), "utf8");
  return file;
}

export async function readReport(reportPath?: string): Promise<Report> {
  const dir = path.resolve(process.cwd(), REPORT_DIR);
  const file = reportPath ?? path.join(dir, "latest.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as Report;
}

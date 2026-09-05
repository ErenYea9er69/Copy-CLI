import { promises as fs } from "node:fs";
import path from "node:path";
import type { RewriteResult } from "../extract/types.js";

export const REPORT_DIR = ".copyshed";
export const BACKUP_DIR = path.join(REPORT_DIR, "backups");

export interface StoredResult extends RewriteResult {
  decision: "pending" | "accepted" | "skipped";
}

export interface Report {
  createdAt: string;
  results: StoredResult[];
}

export interface BackupManifest {
  id: string;
  timestamp: string;
  files: {
    originalPath: string;
    backupRelativePath: string;
  }[];
}

export async function ensureReportDir(): Promise<string> {
  const dir = path.resolve(process.cwd(), REPORT_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureBackupDir(): Promise<string> {
  const dir = path.resolve(process.cwd(), BACKUP_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeReport(
  results: RewriteResult[],
  decisions?: Map<string, "accepted" | "skipped">
): Promise<string> {
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

// ---------------------------------------------------------------------------
// Automated Backup & Restore Engine
// ---------------------------------------------------------------------------

/**
 * Creates an exact pre-modification snapshot of the specified files.
 */
export async function createBackup(filePaths: string[]): Promise<string> {
  const uniqueFiles = [...new Set(filePaths)];
  if (uniqueFiles.length === 0) return "";

  const backupsRoot = await ensureBackupDir();
  const backupId = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFolder = path.join(backupsRoot, backupId);
  await fs.mkdir(backupFolder, { recursive: true });

  const manifest: BackupManifest = {
    id: backupId,
    timestamp: new Date().toISOString(),
    files: [],
  };

  for (let i = 0; i < uniqueFiles.length; i++) {
    const origPath = uniqueFiles[i];
    try {
      const content = await fs.readFile(origPath, "utf8");
      const backupFileName = `file-${i}.bak`;
      const backupFilePath = path.join(backupFolder, backupFileName);
      await fs.writeFile(backupFilePath, content, "utf8");

      manifest.files.push({
        originalPath: origPath,
        backupRelativePath: backupFileName,
      });
    } catch {
      // If file cannot be read, skip
    }
  }

  const manifestPath = path.join(backupFolder, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // Update latest pointer
  const latestPointer = path.join(backupsRoot, "latest.json");
  await fs.writeFile(latestPointer, JSON.stringify(manifest, null, 2), "utf8");

  return backupId;
}

/**
 * Reverts files back to a snapshot (default: latest snapshot).
 */
export async function restoreBackup(
  backupId?: string
): Promise<{ restored: string[]; timestamp: string }> {
  const backupsRoot = await ensureBackupDir();
  let manifest: BackupManifest;

  if (backupId) {
    const manifestPath = path.join(backupsRoot, backupId, "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw) as BackupManifest;
  } else {
    const latestPath = path.join(backupsRoot, "latest.json");
    const raw = await fs.readFile(latestPath, "utf8");
    manifest = JSON.parse(raw) as BackupManifest;
  }

  const backupFolder = path.join(backupsRoot, manifest.id);
  const restored: string[] = [];

  for (const item of manifest.files) {
    const backupFilePath = path.join(backupFolder, item.backupRelativePath);
    const content = await fs.readFile(backupFilePath, "utf8");
    await fs.writeFile(item.originalPath, content, "utf8");
    restored.push(item.originalPath);
  }

  return { restored, timestamp: manifest.timestamp };
}

/**
 * Lists all recorded backup snapshots sorted newest first.
 */
export async function listBackups(): Promise<Array<{ id: string; timestamp: string; fileCount: number }>> {
  const backupsRoot = await ensureBackupDir();
  const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  const results: Array<{ id: string; timestamp: string; fileCount: number }> = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(backupsRoot, entry.name, "manifest.json");
      try {
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw) as BackupManifest;
        results.push({
          id: parsed.id,
          timestamp: parsed.timestamp,
          fileCount: parsed.files.length,
        });
      } catch {
        // Not a valid backup folder, ignore
      }
    }
  }

  return results.sort((a, b) => b.id.localeCompare(a.id));
}

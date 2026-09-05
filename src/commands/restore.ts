import chalk from "chalk";
import { restoreBackup, listBackups } from "../cache/cache.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";

export async function restoreCommand(args: string[]) {
  log.header("restore");
  log.blank();

  if (args.includes("--list") || args.includes("-l")) {
    try {
      const backups = await listBackups();
      if (backups.length === 0) {
        log.info("No backup snapshots found in .copyshed/backups/.");
        log.dim("Snapshots are automatically created before any files are modified by /apply or /auto.");
        log.blank();
        return;
      }

      log.block(
        "Available Backup Snapshots",
        backups.map(
          (b, i) =>
            `${palette.accent(`[${i + 1}]`)} ${palette.bold.white(b.id)}  ${chalk.dim(b.timestamp)} (${b.fileCount} files)`
        ),
        "accent"
      );
      log.blank();
      log.dim("To restore a specific snapshot: /restore <backup-id>");
    } catch {
      log.warn("No backup records found.");
    }
    log.blank();
    return;
  }

  const targetId = args.find((a) => !a.startsWith("-"));

  try {
    const { restored, timestamp } = await restoreBackup(targetId);

    if (restored.length === 0) {
      log.info("No files were affected in this snapshot.");
      log.blank();
      return;
    }

    for (const file of restored) {
      log.ok(`Restored ${palette.bold.white(file)}`);
    }

    log.blank();
    log.block(
      "Restore Complete",
      [
        `${palette.success(sym.tick)} Successfully restored ${restored.length} file(s) to pre-rewrite state.`,
        chalk.dim(`Snapshot timestamp: ${new Date(timestamp).toLocaleString()}`),
      ],
      "success"
    );
  } catch (err: any) {
    const msg =
      err.code === "ENOENT"
        ? "No backup snapshot exists yet. Snapshots are created automatically before changes are applied."
        : err.message ?? "Failed to restore backup.";

    log.block(
      "No Backup Available",
      [
        `${palette.warn(sym.warn)} ${msg}`,
        chalk.dim("Run /auto or /apply to make changes and generate automatic rollback snapshots."),
      ],
      "warn"
    );
  }
  log.blank();
}

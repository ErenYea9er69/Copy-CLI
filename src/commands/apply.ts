import { readReport } from "../cache/cache.js";
import { applyResults } from "../patch/applyPatch.js";
import { log } from "../utils/logger.js";
import type { RewriteResult } from "../extract/types.js";

function matchesPaths(file: string, paths?: string[]): boolean {
  if (!paths || paths.length === 0) return true;
  return paths.some((p) => file === p || file.endsWith(p));
}

export async function applyCommand(args: string[]) {
  const report = await readReport();
  const pending = report.results.filter((r) => r.status !== "failed" && matchesPaths(r.candidate.file, args));

  log.header("apply", `${pending.length} pending suggestion(s)`);
  log.blank();

  if (pending.length === 0) {
    log.info("Nothing to apply from that report.");
    return;
  }

  const toApply: RewriteResult[] = [];

  // Automatically apply everything that is "ok"
  for (const r of pending) {
    if (r.status === "ok" || r.decision === "accepted") {
      toApply.push(r);
    } else {
      log.warn(`Skipped ${r.candidate.file}:${r.candidate.line} (status: ${r.status})`);
    }
  }

  log.blank();
  if (toApply.length === 0) {
    log.info("Nothing applied.");
    return;
  }

  const summaries = await applyResults(toApply);
  const totalChanged = summaries.reduce((sum, s) => sum + s.changed, 0);
  
  for (const s of summaries) {
    if (s.changed > 0) log.ok(`Applied ${s.changed} change(s) to ${s.file}`);
  }
  
  log.blank();
  log.block("Done", [`${totalChanged} change(s) applied across ${summaries.filter((s) => s.changed > 0).length} file(s).`], "success");
}

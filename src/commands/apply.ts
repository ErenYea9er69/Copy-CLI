import { readReport } from "../cache/cache.js";
import { applyResults } from "../patch/applyPatch.js";
import { reviewOne } from "../ui/prompts.js";
import { log } from "../utils/logger.js";
import type { RewriteResult } from "../extract/types.js";

interface ApplyOpts {
  report?: string;
  yes?: boolean;
  paths?: string[];
}

function matchesPaths(file: string, paths?: string[]): boolean {
  if (!paths || paths.length === 0) return true;
  return paths.some((p) => file === p || file.endsWith(p));
}

export async function applyCommand(opts: ApplyOpts) {
  const report = await readReport(opts.report);
  const pending = report.results.filter((r) => r.status !== "failed" && matchesPaths(r.candidate.file, opts.paths));

  if (pending.length === 0) {
    log.info("Nothing to apply from that report.");
    return;
  }

  const toApply: RewriteResult[] = [];

  if (opts.yes) {
    for (const r of pending) {
      if (r.status === "ok" || r.decision === "accepted") toApply.push(r);
    }
  } else {
    for (let i = 0; i < pending.length; i++) {
      const r = pending[i];
      if (r.status === "unchanged") continue;
      if (r.decision === "accepted") {
        toApply.push(r);
        continue;
      }
      const { choice, edited } = await reviewOne(r, i, pending.length);
      if (choice === "quit") break;
      if (choice === "accept" || choice === "accept-all-clean") toApply.push(r);
      if (choice === "edit" && edited != null) toApply.push({ ...r, rewrite: edited });
    }
  }

  if (toApply.length === 0) {
    log.info("Nothing applied.");
    return;
  }

  const summaries = await applyResults(toApply);
  for (const s of summaries) {
    if (s.changed > 0) log.ok(`Applied ${s.changed} change(s) to ${s.file}`);
  }
}

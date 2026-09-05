import chalk from "chalk";
import { readReport, writeReport } from "../cache/cache.js";
import { applyResults } from "../patch/applyPatch.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { reviewInteractively } from "../ui/prompts.js";
import type { RewriteResult } from "../extract/types.js";


function matchesPaths(file: string, paths?: string[]): boolean {
  if (!paths || paths.length === 0) return true;
  return paths.some((p) => file === p || file.endsWith(p));
}

export async function applyCommand(args: string[]) {
  let report;
  try {
    report = await readReport();
  } catch {
    log.header("apply");
    log.blank();
    log.info("No report found in .copyshed/.");
    log.dim("Run /rewrite first to scan your files and generate smart copy improvements.");
    log.blank();
    return;
  }

  const isAuto = args.includes("--yes") || args.includes("-y") || !process.stdin.isTTY;
  const filteredArgs = args.filter((a) => a !== "--yes" && a !== "-y");

  const pending = report.results.filter(
    (r) => r.status !== "failed" && matchesPaths(r.candidate.file, filteredArgs)
  );

  log.header("apply", `${pending.length} candidate suggestion(s)`);
  log.blank();

  if (pending.length === 0) {
    log.info("No pending suggestions to apply.");
    log.dim("All suggestions have either been applied or were skipped. Run /rewrite to discover new strings.");
    log.blank();
    return;
  }

  let toApply: RewriteResult[] = [];
  const decisions = new Map<string, "accepted" | "skipped">();

  if (isAuto) {
    // Non-interactive batch mode: apply clean suggestions
    for (const r of pending) {
      if (r.status === "ok" || r.decision === "accepted") {
        toApply.push(r);
        decisions.set(r.candidate.id, "accepted");
      } else {
        decisions.set(r.candidate.id, "skipped");
        log.warn(`Skipped ${r.candidate.file}:${r.candidate.line} (status: ${r.status})`);
      }
    }
  } else {
    // Interactive step-by-step review
    const { accepted, skipped } = await reviewInteractively(pending);
    toApply = accepted;
    for (const r of accepted) decisions.set(r.candidate.id, "accepted");
    for (const r of skipped) decisions.set(r.candidate.id, "skipped");
  }

  log.blank();
  if (toApply.length === 0) {
    log.info("No changes were accepted. No source files modified.");
    log.blank();
    return;
  }

  const summaries = await applyResults(toApply);
  const totalChanged = summaries.reduce((sum, s) => sum + s.changed, 0);

  for (const s of summaries) {
    if (s.changed > 0) {
      log.ok(`Applied ${s.changed} change(s) to ${palette.bold.white(s.file)}`);
    }
  }

  // Update report cache with recorded decisions
  await writeReport(report.results, decisions);

  log.blank();
  log.block(
    "Application Complete",
    [
      `${palette.success(sym.tick)} Successfully updated ${totalChanged} string(s) across ${summaries.filter((s) => s.changed > 0).length} file(s).`,
      chalk.dim("Saved updated decision status to .copyshed/latest.json."),
    ],
    "success"
  );
  log.blank();
}

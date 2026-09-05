import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { rewriteCandidates } from "../ai/rewrite.js";
import { applyResults } from "../patch/applyPatch.js";
import { writeReport } from "../cache/cache.js";
import { reviewOne } from "../ui/prompts.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { createSpinner, spinnerProgress } from "../ui/spinner.js";
import type { RewriteResult } from "../extract/types.js";

interface RewriteOpts {
  config?: string;
  model?: string;
  maxRetries?: number;
  yes?: boolean;
  dryRun?: boolean;
}

export async function rewriteCommand(paths: string[], opts: RewriteOpts) {
  const config = await loadConfig(opts.config);
  if (opts.model) config.model = opts.model;
  if (opts.maxRetries != null) config.max_retries = opts.maxRetries;

  const files = await resolveFiles(paths, config);
  if (files.length === 0) {
    log.warn("No files matched. Check your include/exclude patterns in copyshed.config.json.");
    return;
  }

  const candidates = await extractFiles(files, config);
  if (candidates.length === 0) {
    log.info("No candidate strings found.");
    return;
  }

  log.header("rewrite", `${candidates.length} string(s)`, `${files.length} file(s)`, `model: ${config.model}`);
  log.blank();

  const spinner = createSpinner("Calling the model...");
  spinner.start();
  const startedAt = Date.now();
  const results = await rewriteCandidates(candidates, config, (done, total, current) => {
    spinner.text = spinnerProgress(done, total, `${current.file}:${current.line}`, startedAt);
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  spinner.succeed(`Model finished  ${palette.muted(`${elapsed}s`)}`);
  log.blank();

  const ok = results.filter((r) => r.status === "ok").length;
  const unchanged = results.filter((r) => r.status === "unchanged").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const failed = results.filter((r) => r.status === "failed").length;

  const summaryLines = [
    `${palette.success(sym.dot)} ${ok} clean`,
    `${palette.muted(sym.dot)} ${unchanged} unchanged`,
    `${palette.danger(sym.dot)} ${needsReview} need review`,
    `${palette.warn(sym.dot)} ${failed} failed`,
  ];
  const tone = needsReview > 0 || failed > 0 ? "warn" as const : "success" as const;
  log.block("Summary", summaryLines, tone);
  log.blank();

  if (opts.dryRun) {
    const reportPath = await writeReport(results);
    log.ok(`Saved suggestions to ${reportPath} without touching any source file.`);
    log.dim("Run `copyshed apply` to review and apply them.");
    log.blank();
    log.status(`model: ${config.model}`, `${elapsed}s`, `${candidates.length} strings`);
    return;
  }

  const decisions = new Map<string, "accepted" | "skipped">();
  const toApply: RewriteResult[] = [];

  if (opts.yes) {
    for (const r of results) {
      if (r.status === "ok") {
        toApply.push(r);
        decisions.set(r.candidate.id, "accepted");
      } else {
        decisions.set(r.candidate.id, "skipped");
      }
    }
  } else {
    let acceptAllClean = false;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "unchanged" || r.status === "failed") {
        decisions.set(r.candidate.id, "skipped");
        continue;
      }
      if (acceptAllClean && r.status === "ok") {
        toApply.push(r);
        decisions.set(r.candidate.id, "accepted");
        continue;
      }
      const { choice, edited } = await reviewOne(r, i, results.length);
      if (choice === "quit") {
        decisions.set(r.candidate.id, "skipped");
        break;
      }
      if (choice === "accept") {
        toApply.push(r);
        decisions.set(r.candidate.id, "accepted");
      } else if (choice === "accept-all-clean") {
        acceptAllClean = true;
        if (r.status === "ok") {
          toApply.push(r);
          decisions.set(r.candidate.id, "accepted");
        }
      } else if (choice === "edit" && edited != null) {
        toApply.push({ ...r, rewrite: edited });
        decisions.set(r.candidate.id, "accepted");
      } else {
        decisions.set(r.candidate.id, "skipped");
      }
    }
  }

  log.blank();
  if (toApply.length > 0) {
    const summaries = await applyResults(toApply);
    const totalChanged = summaries.reduce((sum, s) => sum + s.changed, 0);
    for (const s of summaries) {
      if (s.changed > 0) log.ok(`Applied ${s.changed} change(s) to ${s.file}`);
    }
    log.blank();
    log.block("Done", [`${totalChanged} change(s) applied across ${summaries.filter((s) => s.changed > 0).length} file(s).`], "success");
  } else {
    log.info("Nothing applied.");
  }

  const reportPath = await writeReport(results, decisions);
  log.dim(`Report saved to ${reportPath}`);
  log.blank();
  log.status(`model: ${config.model}`, `${elapsed}s`, `${candidates.length} strings`);
}

import ora from "ora";
import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { rewriteCandidates } from "../ai/rewrite.js";
import { applyResults } from "../patch/applyPatch.js";
import { writeReport } from "../cache/cache.js";
import { reviewOne } from "../ui/prompts.js";
import { log } from "../utils/logger.js";
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

  log.heading(`${candidates.length} candidate string(s) across ${files.length} file(s)`);

  const spinner = ora("Calling the model...").start();
  const results = await rewriteCandidates(candidates, config, (done, total, current) => {
    spinner.text = `Rewriting ${done}/${total}: ${current.file}:${current.line}`;
  });
  spinner.stop();

  const ok = results.filter((r) => r.status === "ok").length;
  const unchanged = results.filter((r) => r.status === "unchanged").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const failed = results.filter((r) => r.status === "failed").length;
  log.info(`${ok} clean, ${unchanged} unchanged, ${needsReview} need review, ${failed} failed to reach the model.`);

  if (opts.dryRun) {
    const reportPath = await writeReport(results);
    log.ok(`Saved suggestions to ${reportPath} without touching any source file.`);
    log.dim("Run `copyshed apply` to review and apply them.");
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

  if (toApply.length > 0) {
    const summaries = await applyResults(toApply);
    for (const s of summaries) {
      if (s.changed > 0) log.ok(`Applied ${s.changed} change(s) to ${s.file}`);
    }
  } else {
    log.info("Nothing applied.");
  }

  const reportPath = await writeReport(results, decisions);
  log.dim(`Report saved to ${reportPath}`);
}

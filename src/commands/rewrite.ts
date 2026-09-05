import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { rewriteCandidates } from "../ai/rewrite.js";
import { writeReport } from "../cache/cache.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { createSpinner, spinnerProgress } from "../ui/spinner.js";

export async function rewriteCommand(args: string[]) {
  const config = await loadConfig();
  const paths = args.length > 0 ? args : config.include;

  const files = await resolveFiles(paths, config);
  if (files.length === 0) {
    log.header("rewrite");
    log.blank();
    log.warn("No files matched your configured patterns. Check copyshed.config.json.");
    log.blank();
    return;
  }

  const candidates = await extractFiles(files, config);
  if (candidates.length === 0) {
    log.header("rewrite", `${files.length} file(s)`);
    log.blank();
    log.info("No candidate UI strings found to rewrite.");
    log.blank();
    return;
  }

  log.header("rewrite", `${candidates.length} string(s)`, `${files.length} file(s)`, `model: ${config.model}`);
  log.blank();

  const spinner = createSpinner("Analyzing copy and crafting improvements...");
  spinner.start();
  const startedAt = Date.now();

  const results = await rewriteCandidates(candidates, config, (done, total, current) => {
    spinner.text = spinnerProgress(done, total, `${current.file}:${current.line}`, startedAt);
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  spinner.succeed(`Copy generation complete  ${palette.muted(`(${elapsed}s)`)}`);
  log.blank();

  const ok = results.filter((r) => r.status === "ok").length;
  const unchanged = results.filter((r) => r.status === "unchanged").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;
  const failed = results.filter((r) => r.status === "failed").length;

  const summaryLines = [
    `${palette.success(sym.tick)} ${ok} clean & ready`,
    `${palette.muted(sym.circle)} ${unchanged} unchanged (already aligned)`,
    `${palette.warn(sym.warn)} ${needsReview} require review`,
    `${palette.danger(sym.cross)} ${failed} failed to process`,
  ];

  const tone = needsReview > 0 || failed > 0 ? ("warn" as const) : ("success" as const);
  log.block("Summary", summaryLines, tone);
  log.blank();

  const reportPath = await writeReport(results);
  log.ok(`Saved suggestions to ${reportPath} (source files untouched).`);
  log.info(`Run ${palette.accent("/apply")} to step through and apply them.`);
  log.blank();
  log.status(`model: ${config.model}`, `${elapsed}s`, `${candidates.length} strings`);
}

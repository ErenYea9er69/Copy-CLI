import chalk from "chalk";
import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { checkHardRules } from "../rules/validator.js";
import { clarityScore } from "../rules/score.js";
import { rewriteCandidates } from "../ai/rewrite.js";
import { applyResults } from "../patch/applyPatch.js";
import { writeReport } from "../cache/cache.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { createSpinner, spinnerProgress } from "../ui/spinner.js";
import { renderReviewDiff } from "../ui/diff.js";

/**
 * 100% Automated Autonomous AI Pipeline:
 * Discovers strings -> Audits -> Rewrites -> Backs up -> Patches files
 * Zero manual prompts or friction.
 */
export async function autoCommand(args: string[]) {
  log.header("auto", "Autonomous AI Copy Engine");
  log.blank();

  const config = await loadConfig();
  const forceAll = args.includes("--all");
  const filteredPaths = args.filter((a) => a !== "--all");
  const paths = filteredPaths.length > 0 ? filteredPaths : config.include;

  const files = await resolveFiles(paths, config);
  if (files.length === 0) {
    log.warn("No files matched configured include/exclude globs.");
    log.blank();
    return;
  }

  const allCandidates = await extractFiles(files, config);
  if (allCandidates.length === 0) {
    log.info("No UI strings found across scanned files.");
    log.blank();
    return;
  }

  // Filter candidates that actually need improvement
  const needsWork = allCandidates.filter((c) => {
    if (forceAll) return true;
    const violations = checkHardRules(c.value);
    if (violations.length > 0) return true;
    const score = clarityScore(c.value, config.reading_level_target).score;
    return score < 75;
  });

  if (needsWork.length === 0) {
    log.block(
      "All Strings Clean",
      [
        `${palette.success(sym.tick)} All ${allCandidates.length} strings already meet high clarity and style standards!`,
        chalk.dim("Tip: Pass '/auto --all' if you wish to force an AI stylistic rewrite on every string."),
      ],
      "success"
    );
    log.blank();
    return;
  }

  log.info(
    `Discovered ${allCandidates.length} strings. Selected ${palette.bold.white(String(needsWork.length))} string(s) for autonomous improvement.`
  );
  log.blank();

  const spinner = createSpinner("Autonomous AI is optimizing copy...");
  spinner.start();
  const startedAt = Date.now();

  let results;
  try {
    results = await rewriteCandidates(needsWork, config, (done, total, current) => {
      spinner.text = spinnerProgress(done, total, `${current.file}:${current.line}`, startedAt);
    });
  } catch (err: any) {
    spinner.fail("AI rewriting paused.");
    log.blank();
    log.block(
      "AI API Key Required",
      [
        `${palette.warn(sym.warn)} ${err.message}`,
        "",
        "To enable autonomous AI rewriting, set any supported key in your .env file:",
        `  ${palette.accent("• ANTHROPIC_API_KEY")} (Claude 3.5 / 3.7 Sonnet)`,
        `  ${palette.accent("• GEMINI_API_KEY")}    (Google Gemini 2.0 Flash)`,
        `  ${palette.accent("• OPENAI_API_KEY")}    (GPT-4o / GPT-4o-mini)`,
        `  ${palette.accent("• GROQ_API_KEY")}      (Llama 3.3 70B via Groq)`,
        `  ${palette.accent("• DEEPSEEK_API_KEY")}  (DeepSeek Chat)`,
      ],
      "warn"
    );
    log.blank();
    return;
  }


  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  spinner.succeed(`AI processing completed in ${elapsed}s`);
  log.blank();

  const validRewrites = results.filter(
    (r) => r.status === "ok" && r.rewrite.trim() !== r.candidate.value.trim()
  );

  if (validRewrites.length === 0) {
    log.info("No compliant improvements could be validated. Files were left untouched.");
    log.blank();
    return;
  }

  // Record decisions and write report
  const decisions = new Map(validRewrites.map((r) => [r.candidate.id, "accepted" as const]));
  await writeReport(results, decisions);

  // Apply patches (automatically creates a pre-modification snapshot backup)
  const summaries = await applyResults(validRewrites);
  const totalChanged = summaries.reduce((sum, s) => sum + s.changed, 0);

  // Display clean visual diffs for applied changes
  for (const r of validRewrites.slice(0, 10)) {
    const delta = (r.scoreAfter ?? 0) - (r.scoreBefore ?? 0);
    const deltaStr = delta > 0 ? palette.success(`+${delta}`) : chalk.dim(String(delta));
    console.log(
      `${palette.accent(sym.pointer)} ${palette.bold.white(r.candidate.file)}:${chalk.dim(String(r.candidate.line))}  ${chalk.dim(`(Score: ${r.scoreBefore} → ${r.scoreAfter} ${deltaStr})`)}`
    );
    console.log(renderReviewDiff(r.candidate.value, r.rewrite));
    console.log("");
  }

  if (validRewrites.length > 10) {
    log.dim(`  ...and ${validRewrites.length - 10} more string(s) updated.`);
    log.blank();
  }

  log.block(
    "Auto-Pilot Complete",
    [
      `${palette.success(sym.tick)} Successfully improved ${totalChanged} string(s) across ${summaries.filter((s) => s.changed > 0).length} file(s).`,
      "Pre-modification backup created automatically in .copyshed/backups/.",
      chalk.dim("To revert all changes instantly: /restore"),
    ],
    "success"
  );
  log.blank();
}

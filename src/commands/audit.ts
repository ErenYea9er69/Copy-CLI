import chalk from "chalk";
import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { inferRole } from "../rules/psychology.js";
import { clarityScore } from "../rules/score.js";
import { renderAuditTable } from "../ui/table.js";
import { log } from "../utils/logger.js";
import { palette, sym, progressBar } from "../ui/theme.js";
import { withSpinner } from "../ui/spinner.js";

export async function auditCommand(args: string[]) {
  const config = await loadConfig();

  let threshold = 60;
  let paths = [...config.include];

  if (args.length > 0) {
    const tIndex = args.indexOf("--threshold");
    if (tIndex !== -1 && args[tIndex + 1]) {
      threshold = parseInt(args[tIndex + 1], 10) || 60;
      args.splice(tIndex, 2);
    }
    if (args.length > 0) {
      paths = args;
    }
  }

  const { result, elapsed } = await withSpinner("Analyzing copy strings and evaluating clarity scores...", async () => {
    const files = await resolveFiles(paths, config);
    if (files.length === 0) return { files: [], rows: [] };

    const candidates = await extractFiles(files, config);
    const rows = candidates.map((candidate) => {
      const role = inferRole(candidate, config);
      const score = clarityScore(candidate.value, config.reading_level_target);
      return { location: `${candidate.file}:${candidate.line}`, role, value: candidate.value, score };
    });

    return { files, rows };
  });

  const { files, rows } = result;

  log.header("audit", `${rows.length} string(s)`, `${files.length} file(s)`);
  log.blank();

  if (rows.length === 0) {
    log.info("No strings found to audit.");
    log.dim("Verify file patterns or check that key and attribute allowlists include your strings.");
    log.blank();
    return;
  }

  const below = rows.filter((r) => r.score.score < threshold);
  const sorted = [...rows].sort((a, b) => a.score.score - b.score.score);
  console.log(renderAuditTable(sorted.slice(0, 40)));

  if (rows.length > 40) {
    log.blank();
    log.dim(`  ...and ${rows.length - 40} more string(s), displaying the lowest-scoring 40.`);
  }

  const average = Math.round(rows.reduce((sum, r) => sum + r.score.score, 0) / rows.length);
  log.blank();

  const tone = below.length === 0 ? "success" : average < threshold ? "danger" : "warn";
  const scoreBar = progressBar(average, 100, 20);

  log.block(
    `Audited Clarity Score: ${average}/100`,
    [
      `Overall Rating: ${scoreBar}`,
      below.length === 0
        ? `${palette.success(sym.tick)} Excellent! All strings meet or exceed the clarity threshold of ${threshold}.`
        : `${palette.warn(sym.warn)} ${below.length} string(s) fall below the target threshold of ${threshold}. Run /rewrite to improve them.`,
    ],
    tone
  );
  log.blank();
  log.status(`${elapsed.toFixed(1)}s`, `threshold: ${threshold}`, `target grade: ${config.reading_level_target}`);
}

import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { inferRole } from "../rules/psychology.js";
import { clarityScore } from "../rules/score.js";
import { renderAuditTable } from "../ui/table.js";
import { log } from "../utils/logger.js";

export async function auditCommand(args: string[]) {
  const start = Date.now();
  const config = await loadConfig();
  
  // Custom parsing for threshold arg in REPL
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

  const files = await resolveFiles(paths, config);
  const candidates = await extractFiles(files, config);

  const rows = candidates.map((candidate) => {
    const role = inferRole(candidate, config);
    const score = clarityScore(candidate.value, config.reading_level_target);
    return { location: `${candidate.file}:${candidate.line}`, role, value: candidate.value, score };
  });

  const below = rows.filter((r) => r.score.score < threshold);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  log.header("audit", `${candidates.length} string(s)`, `${files.length} file(s)`);
  log.blank();
  if (rows.length === 0) {
    log.info("Nothing to score.");
    return;
  }

  const sorted = [...rows].sort((a, b) => a.score.score - b.score.score);
  console.log(renderAuditTable(sorted.slice(0, 40)));
  
  if (rows.length > 40) {
    log.dim(`...and ${rows.length - 40} more string(s), showing the lowest-scoring 40.`);
  }

  const average = Math.round(rows.reduce((sum, r) => sum + r.score.score, 0) / rows.length);
  log.blank();
  const tone = below.length === 0 ? "success" : average < threshold ? "danger" : "warn";
  log.block(`Average clarity score: ${average}/100`, [`${below.length} string(s) fall below the threshold of ${threshold}.`], tone);
  log.blank();
  log.status(`${elapsed}s`, `threshold: ${threshold}`);
}

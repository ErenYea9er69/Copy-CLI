import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { inferRole } from "../rules/psychology.js";
import { clarityScore } from "../rules/score.js";
import { renderAuditTable } from "../ui/table.js";
import { log } from "../utils/logger.js";

/**
 * Scores copy already in the codebase against the heuristics in
 * rules/score.ts: reading grade, passive-voice density, vague quantifiers,
 * banned words, em dashes. No API call, no API key, safe for CI as a
 * softer companion to `check` (which only fails on the hard rules).
 *
 * The score is a smoke alarm, not a verdict. It tells a team where to
 * spend review time. It does not know if a claim is true or if a joke
 * lands, and it is not a stand-in for an actual A/B test.
 */
export async function auditCommand(paths: string[], opts: { config?: string; json?: boolean; threshold?: number }) {
  const config = await loadConfig(opts.config);
  const files = await resolveFiles(paths, config);
  const candidates = await extractFiles(files, config);

  const rows = candidates.map((candidate) => {
    const role = inferRole(candidate, config);
    const score = clarityScore(candidate.value, config.reading_level_target);
    return { location: `${candidate.file}:${candidate.line}`, role, value: candidate.value, score };
  });

  const threshold = opts.threshold ?? 60;
  const below = rows.filter((r) => r.score.score < threshold);

  if (opts.json) {
    console.log(JSON.stringify({ files: files.length, candidates: candidates.length, threshold, rows }, null, 2));
    process.exitCode = below.length > 0 ? 1 : 0;
    return;
  }

  log.title("Clarity audit", `${candidates.length} string(s) across ${files.length} file(s)`);
  log.blank();
  if (rows.length === 0) {
    log.info("Nothing to score.");
    return;
  }

  const sorted = [...rows].sort((a, b) => a.score.score - b.score.score);
  console.log(renderAuditTable(sorted.slice(0, 40)));
  if (rows.length > 40) log.dim(`...and ${rows.length - 40} more string(s), showing the lowest-scoring 40.`);

  const average = Math.round(rows.reduce((sum, r) => sum + r.score.score, 0) / rows.length);
  log.blank();
  const tone = below.length === 0 ? "success" : average < threshold ? "danger" : "warn";
  log.panel(`Average clarity score: ${average}/100`, [`${below.length} string(s) fall below the threshold of ${threshold}.`], tone);
  process.exitCode = below.length > 0 ? 1 : 0;
}

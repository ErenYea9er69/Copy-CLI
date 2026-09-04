import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { checkHardRules } from "../rules/validator.js";
import { renderViolationTable } from "../ui/table.js";
import { log } from "../utils/logger.js";

/**
 * Runs the hard rules against copy already in the codebase, no API call
 * involved. This is the command to wire into CI or a pre-commit hook: it
 * enforces the shared style guide without needing an API key or network
 * access, and it never rewrites anything on its own.
 */
export async function checkCommand(paths: string[], opts: { config?: string; json?: boolean }) {
  const config = await loadConfig(opts.config);
  const files = await resolveFiles(paths, config);
  const candidates = await extractFiles(files, config);

  const rows: { location: string; value: string; violations: ReturnType<typeof checkHardRules> }[] = [];
  for (const candidate of candidates) {
    const violations = checkHardRules(candidate.value);
    if (violations.length > 0) {
      rows.push({ location: `${candidate.file}:${candidate.line}`, value: candidate.value, violations });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ files: files.length, candidates: candidates.length, violations: rows }, null, 2));
    process.exitCode = rows.length > 0 ? 1 : 0;
    return;
  }

  log.heading(`Checked ${candidates.length} string(s) across ${files.length} file(s)`);
  if (rows.length === 0) {
    log.ok("No style guide violations found.");
    process.exitCode = 0;
    return;
  }

  console.log(renderViolationTable(rows));
  log.error(`${rows.length} string(s) break the house style.`);
  process.exitCode = 1;
}

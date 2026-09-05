import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { checkHardRules } from "../rules/validator.js";
import { renderViolationTable } from "../ui/table.js";
import { log } from "../utils/logger.js";

export async function checkCommand(args: string[]) {
  const start = Date.now();
  const config = await loadConfig();
  const paths = args.length > 0 ? args : config.include;
  const files = await resolveFiles(paths, config);
  const candidates = await extractFiles(files, config);

  const rows: { location: string; value: string; violations: ReturnType<typeof checkHardRules> }[] = [];
  for (const candidate of candidates) {
    const violations = checkHardRules(candidate.value);
    if (violations.length > 0) {
      rows.push({ location: `${candidate.file}:${candidate.line}`, value: candidate.value, violations });
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  log.header("check", `${candidates.length} string(s)`, `${files.length} file(s)`);
  log.blank();
  
  if (rows.length === 0) {
    log.block("Passed", ["No style guide violations found."], "success");
    log.blank();
    log.status(`${elapsed}s`);
    return;
  }

  console.log(renderViolationTable(rows));
  log.blank();
  log.block("Failed", [`${rows.length} string(s) break the house style.`], "danger");
  log.blank();
  log.status(`${elapsed}s`);
}

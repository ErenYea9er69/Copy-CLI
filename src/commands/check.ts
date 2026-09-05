import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { checkHardRules } from "../rules/validator.js";
import { renderViolationTable } from "../ui/table.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { withSpinner } from "../ui/spinner.js";

export async function checkCommand(args: string[]): Promise<boolean> {
  const config = await loadConfig();
  const paths = args.length > 0 ? args : config.include;

  const { result, elapsed } = await withSpinner("Scanning and checking strings against house rules...", async () => {
    const files = await resolveFiles(paths, config);
    const candidates = await extractFiles(files, config);

    const rows: { location: string; value: string; violations: ReturnType<typeof checkHardRules> }[] = [];
    for (const candidate of candidates) {
      const violations = checkHardRules(candidate.value);
      if (violations.length > 0) {
        rows.push({ location: `${candidate.file}:${candidate.line}`, value: candidate.value, violations });
      }
    }
    return { files, candidates, rows };
  });

  const { files, candidates, rows } = result;

  log.header("check", `${candidates.length} string(s)`, `${files.length} file(s)`);
  log.blank();

  if (rows.length === 0) {
    log.block(
      "Style Check Passed",
      [
        `${palette.success(sym.tick)} Clean! All ${candidates.length} string(s) conform to the house style.`,
        "No em dashes, banned words, or syntax violations found.",
      ],
      "success"
    );
    log.blank();
    log.status(`${elapsed.toFixed(1)}s`, `${candidates.length} strings checked`);
    return true;
  }

  console.log(renderViolationTable(rows));
  log.blank();
  log.block(
    "Style Check Failed",
    [
      `${palette.danger(sym.cross)} Found ${rows.length} string(s) violating core house style rules.`,
      "Fix violations manually or run /rewrite to generate compliant alternatives.",
    ],
    "danger"
  );
  log.blank();
  log.status(`${elapsed.toFixed(1)}s`, `${rows.length} violation(s)`);
  return false;
}

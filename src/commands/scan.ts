import chalk from "chalk";
import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { renderCandidateTable } from "../ui/table.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { withSpinner } from "../ui/spinner.js";


export async function scanCommand(args: string[]) {
  const config = await loadConfig();
  const paths = args.length > 0 ? args : config.include;

  const { result, elapsed } = await withSpinner("Scanning project for UI copy strings...", async () => {
    const files = await resolveFiles(paths, config);
    if (files.length === 0) {
      return { files: [], candidates: [] };
    }
    const candidates = await extractFiles(files, config);
    return { files, candidates };
  });

  const { files, candidates } = result;

  if (files.length === 0) {
    log.header("scan");
    log.blank();
    log.warn("No source files matched your configured patterns.");
    log.dim(`Searched patterns: ${paths.join(", ")}`);
    log.dim("Verify your include / exclude globs in copyshed.config.json or pass explicit paths.");
    log.blank();
    return;
  }

  log.header("scan", `${files.length} file(s)`, `${candidates.length} string(s)`);
  log.blank();

  if (candidates.length > 0) {
    console.log(renderCandidateTable(candidates));
    log.blank();
    log.info(
      `${palette.success(sym.tick)} Found ${candidates.length} UI candidate string(s). Run ${palette.accent("/rewrite")} to generate brand-aligned improvements.`
    );
  } else {
    log.block(
      "Scan Complete",
      [
        "No UI strings matching your attribute and key allowlists were found.",
        chalk.dim("Check attribute_allowlist and key_allowlist in copyshed.config.json."),
      ],
      "neutral"
    );
  }

  log.blank();
  log.status(`${elapsed.toFixed(1)}s`, `${files.length} files scanned`);
}

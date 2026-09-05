import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { renderCandidateTable } from "../ui/table.js";
import { log } from "../utils/logger.js";
import { palette } from "../ui/theme.js";

export async function scanCommand(args: string[]) {
  const start = Date.now();
  const config = await loadConfig();
  const paths = args.length > 0 ? args : config.include;
  const files = await resolveFiles(paths, config);

  if (files.length === 0) {
    log.warn("No files matched. Check your include/exclude patterns in copyshed.config.json.");
    return;
  }

  const candidates = await extractFiles(files, config);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  log.header("scan", `${files.length} file(s)`, `${candidates.length} string(s)`);
  log.blank();
  
  if (candidates.length > 0) {
    console.log(renderCandidateTable(candidates));
    log.blank();
    log.info(`${candidates.length} candidate string(s) found. Run ${palette.accent("/rewrite")} to generate suggestions.`);
  } else {
    log.ok("No candidate strings found.");
  }
  
  log.blank();
  log.status(`${elapsed}s`);
}

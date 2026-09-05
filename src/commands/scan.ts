import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { renderCandidateTable } from "../ui/table.js";
import { log } from "../utils/logger.js";
import { palette } from "../ui/theme.js";

export async function scanCommand(paths: string[], opts: { config?: string; json?: boolean }) {
  const config = await loadConfig(opts.config);
  const files = await resolveFiles(paths, config);

  if (files.length === 0) {
    log.warn("No files matched. Check your include/exclude patterns in copyshed.config.json.");
    return;
  }

  const candidates = await extractFiles(files, config);

  if (opts.json) {
    console.log(JSON.stringify({ files: files.length, candidates }, null, 2));
    return;
  }

  log.title("Scan results", `${files.length} file(s) checked`);
  log.blank();
  if (candidates.length > 0) {
    console.log(renderCandidateTable(candidates));
    log.blank();
    log.info(`${candidates.length} candidate string(s) found. Run ${palette.accent("copyshed rewrite")} to generate suggestions.`);
  } else {
    log.ok("No candidate strings found.");
  }
}

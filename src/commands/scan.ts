import { loadConfig } from "../config.js";
import { resolveFiles } from "../utils/glob.js";
import { extractFiles } from "../extract/extractor.js";
import { renderCandidateTable } from "../ui/table.js";
import { log } from "../utils/logger.js";

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

  log.heading(`Scanned ${files.length} file(s), found ${candidates.length} candidate string(s)`);
  if (candidates.length > 0) {
    console.log(renderCandidateTable(candidates));
  }
}

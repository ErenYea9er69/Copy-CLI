import chokidar from "chokidar";
import chalk from "chalk";
import type { Config } from "../config/schema.js";
import { extractFile } from "../extract/index.js";
import { rewriteAll } from "../rewrite/index.js";
import { printPreview } from "../diff/preview.js";
import { applyChanges } from "../apply/applyChanges.js";

export interface WatchOptions {
  cwd: string;
  config: Config;
  autoApply: boolean;
}

/**
 * Simulates an editor's "on-save" hook from the CLI: watch the configured
 * globs, and on every change, re-scan just that file. This is what a VS
 * Code extension (see editor/vscode-extension) wires into the save event
 * instead of a filesystem watcher.
 */
export function startWatch({ cwd, config, autoApply }: WatchOptions): void {
  console.log(chalk.dim(`Watching ${config.include.join(", ")} for changes...`));
  console.log(chalk.dim(autoApply ? "Auto-apply is ON." : "Preview only. Pass --apply to write changes on save."));

  const watcher = chokidar.watch(config.include, {
    cwd,
    ignored: config.exclude,
    ignoreInitial: true
  });

  const handle = async (relPath: string) => {
    const absPath = relPath.startsWith(cwd) ? relPath : `${cwd}/${relPath}`;
    console.log(chalk.dim(`\n[copyshed] ${relPath} changed`));
    const extraction = extractFile(absPath, config);
    if (extraction.strings.length === 0) return;

    const results = await rewriteAll(extraction.strings, config);
    printPreview(results, cwd);

    if (autoApply) {
      const summary = applyChanges(results);
      if (summary.stringsChanged > 0) {
        console.log(chalk.green(`Applied ${summary.stringsChanged} change(s) to ${relPath}`));
      }
    }
  };

  watcher.on("change", handle).on("add", handle);
}

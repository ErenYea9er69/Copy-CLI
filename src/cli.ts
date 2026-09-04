#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config/loader.js";
import { walkFiles } from "./utils/fileWalker.js";
import { extractFile, extractFiles } from "./extract/index.js";
import { rewriteAll } from "./rewrite/index.js";
import { printPreview } from "./diff/preview.js";
import { applyChanges } from "./apply/applyChanges.js";
import { runLint } from "./lint/lintRunner.js";
import { startWatch } from "./watch/watcher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

const program = new Command();

program
  .name("copyshed")
  .description(
    "Finds UI copy in your codebase and rewrites it to match your brand voice, audience, and goals."
  )
  .version("0.1.0");

program
  .command("init")
  .description("Create a copyshed.config.json in the current directory")
  .option("-f, --force", "overwrite an existing config file", false)
  .action((opts) => {
    const target = resolve(cwd, "copyshed.config.json");
    if (existsSync(target) && !opts.force) {
      console.log(chalk.yellow(`copyshed.config.json already exists. Use --force to overwrite it.`));
      return;
    }
    const example = resolve(__dirname, "..", "copyshed.config.example.json");
    const fallbackExample = resolve(__dirname, "copyshed.config.example.json");
    const src = existsSync(example) ? example : fallbackExample;
    copyFileSync(src, target);
    console.log(chalk.green(`Created ${target}`));
    console.log(chalk.dim("Edit audience, brandVoice, and bannedWords, then run `copyshed scan`."));
  });

program
  .command("scan")
  .description("Preview rewrites without changing any files (safe, read-only)")
  .option("-c, --config <path>", "path to config file")
  .option("--file <path>", "scan a single file instead of the configured include globs")
  .action(async (opts) => {
    const config = loadConfig(cwd, opts.config);
    const files = opts.file ? [resolve(cwd, opts.file)] : await walkFiles(cwd, config);

    if (files.length === 0) {
      console.log(chalk.yellow("No files matched the configured include/exclude globs."));
      return;
    }

    const extractions = extractFiles(files, config);
    const strings = extractions.flatMap((e) => e.strings);

    console.log(chalk.dim(`Scanned ${files.length} file(s), found ${strings.length} copy string(s).`));

    if (strings.length === 0) return;

    const results = await rewriteAll(strings, config);
    printPreview(results, cwd);
  });

program
  .command("apply")
  .description("Rewrite copy in place. Runs a preview first unless --yes is passed.")
  .option("-c, --config <path>", "path to config file")
  .option("--file <path>", "apply to a single file instead of the configured include globs")
  .option("-y, --yes", "skip the preview and write changes immediately", false)
  .option("--dry-run", "alias for `scan`: preview only, never write", false)
  .action(async (opts) => {
    const config = loadConfig(cwd, opts.config);
    const files = opts.file ? [resolve(cwd, opts.file)] : await walkFiles(cwd, config);

    if (files.length === 0) {
      console.log(chalk.yellow("No files matched the configured include/exclude globs."));
      return;
    }

    const extractions = extractFiles(files, config);
    const strings = extractions.flatMap((e) => e.strings);

    if (strings.length === 0) {
      console.log(chalk.dim("No copy strings found."));
      return;
    }

    const results = await rewriteAll(strings, config);
    const { changed } = printPreview(results, cwd);

    if (opts.dryRun) return;

    if (changed === 0) {
      console.log(chalk.dim("Nothing to apply."));
      return;
    }

    if (!opts.yes) {
      console.log(
        chalk.yellow(
          `\nRun with --yes to write these ${changed} change(s) to disk, or review the diff above first.`
        )
      );
      return;
    }

    const summary = applyChanges(results);
    console.log(
      chalk.green(
        `\nApplied ${summary.stringsChanged} change(s) across ${summary.filesChanged} file(s).`
      )
    );
  });

program
  .command("lint")
  .description("CI-friendly check: reports style guide violations, exits non-zero if any remain")
  .option("-c, --config <path>", "path to config file")
  .action(async (opts) => {
    const config = loadConfig(cwd, opts.config);
    const files = await walkFiles(cwd, config);
    const extractions = extractFiles(files, config);
    const strings = extractions.flatMap((e) => e.strings);

    const report = runLint(strings, config, cwd);
    if (!report.ok) {
      process.exitCode = 1;
    }
  });

program
  .command("watch")
  .description("Watch configured files and preview (or apply) rewrites on save")
  .option("-c, --config <path>", "path to config file")
  .option("--apply", "write changes automatically instead of only previewing", false)
  .action((opts) => {
    const config = loadConfig(cwd, opts.config);
    startWatch({ cwd, config, autoApply: opts.apply });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(`copyshed: ${(err as Error).message}`));
  process.exitCode = 1;
});

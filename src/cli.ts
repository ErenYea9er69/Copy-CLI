#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { rewriteCommand } from "./commands/rewrite.js";
import { applyCommand } from "./commands/apply.js";
import { checkCommand } from "./commands/check.js";
import { log } from "./utils/logger.js";

const program = new Command();

program
  .name("copyshed")
  .description("Find user-facing strings in your code and rewrite them to match your brand voice and a strict house style.")
  .version("0.1.0");

program
  .command("init")
  .description("create a copyshed.config.json in the current project")
  .option("-y, --yes", "skip prompts and write defaults")
  .action(async (opts) => {
    await initCommand(opts);
  });

program
  .command("scan")
  .description("list user-facing strings found in the given paths, without calling the model")
  .argument("[paths...]", "glob patterns to scan, defaults to the config's include list")
  .option("-c, --config <path>", "path to copyshed.config.json")
  .option("--json", "print machine-readable JSON instead of a table")
  .action(async (paths, opts) => {
    await scanCommand(paths, opts);
  });

program
  .command("rewrite")
  .description("rewrite candidate strings to match the house style, then review and apply them")
  .argument("[paths...]", "glob patterns to scan, defaults to the config's include list")
  .option("-c, --config <path>", "path to copyshed.config.json")
  .option("-m, --model <name>", "override the model from config")
  .option("--max-retries <n>", "override retry count for failed validation", (v) => parseInt(v, 10))
  .option("-y, --yes", "non-interactive: accept every suggestion that passes validation, skip the rest")
  .option("--dry-run", "call the model and save a report, but do not touch any file or prompt")
  .action(async (paths, opts) => {
    await rewriteCommand(paths, opts);
  });

program
  .command("apply")
  .description("review and apply a report saved by `rewrite --dry-run`")
  .option("-r, --report <path>", "path to a specific report file, defaults to the latest")
  .option("-y, --yes", "non-interactive: apply every suggestion already marked accepted or clean")
  .option("-p, --paths <patterns...>", "only apply entries whose file matches one of these")
  .action(async (opts) => {
    await applyCommand(opts);
  });

program
  .command("check")
  .description("deterministic style guide gate: fails if banned words, em dashes, or markdown show up in existing copy. No API key needed, safe for CI.")
  .argument("[paths...]", "glob patterns to scan, defaults to the config's include list")
  .option("-c, --config <path>", "path to copyshed.config.json")
  .option("--json", "print machine-readable JSON instead of a table")
  .action(async (paths, opts) => {
    await checkCommand(paths, opts);
  });

program.parseAsync(process.argv).catch((err) => {
  log.error(err?.message ?? String(err));
  process.exitCode = 1;
});

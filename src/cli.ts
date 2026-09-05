#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { rewriteCommand } from "./commands/rewrite.js";
import { applyCommand } from "./commands/apply.js";
import { checkCommand } from "./commands/check.js";
import { auditCommand } from "./commands/audit.js";
import { log } from "./utils/logger.js";
import { banner, palette, sym } from "./ui/theme.js";

function getVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = getVersion();
const program = new Command();

const EXAMPLES = [
  ["copyshed init", "create copyshed.config.json in this project"],
  ["copyshed scan src/", "list user-facing strings, no API call"],
  ["copyshed check", "CI gate: fail on banned words / em dashes"],
  ["copyshed audit --threshold 70", "score existing copy for clarity"],
  ["copyshed rewrite src/ -y", "rewrite copy, auto-accept clean results"],
  ["copyshed apply", "review a saved dry-run report and apply it"],
] as const;

function examplesBlock(): string {
  const lines = EXAMPLES.map(
    ([cmd, desc]) => `  ${palette.accent(cmd.padEnd(34))}${chalk.dim(desc)}`
  );
  return [chalk.bold.white("Examples:"), ...lines].join("\n");
}

program
  .name("copyshed")
  .description(
    "Find user-facing strings in your code and rewrite them to match your brand voice and a strict house style."
  )
  .version(version, "-v, --version", "print the current version")
  .addHelpText("beforeAll", () => `\n${banner(version)}\n`)
  .addHelpText("afterAll", () => `\n${examplesBlock()}\n`)
  .showHelpAfterError(chalk.dim("(run with --help for usage)"));

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
  .description(
    "deterministic style guide gate: fails if banned words, em dashes, or markdown show up in existing copy. No API key needed, safe for CI."
  )
  .argument("[paths...]", "glob patterns to scan, defaults to the config's include list")
  .option("-c, --config <path>", "path to copyshed.config.json")
  .option("--json", "print machine-readable JSON instead of a table")
  .action(async (paths, opts) => {
    await checkCommand(paths, opts);
  });

program
  .command("audit")
  .description(
    "score existing copy for clarity and specificity (reading grade, passive voice, vague quantifiers). No API key needed, safe for CI."
  )
  .argument("[paths...]", "glob patterns to scan, defaults to the config's include list")
  .option("-c, --config <path>", "path to copyshed.config.json")
  .option("--json", "print machine-readable JSON instead of a table")
  .option("--threshold <n>", "minimum passing clarity score, 0-100", (v) => parseInt(v, 10))
  .action(async (paths, opts) => {
    await auditCommand(paths, opts);
  });

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err) => {
  log.blank();
  log.block("Something went wrong", [palette.danger(err?.message ?? String(err))], "danger");
  process.exitCode = 1;
});

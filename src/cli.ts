#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import chalk from "chalk";
import * as readline from "node:readline/promises";

import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { rewriteCommand } from "./commands/rewrite.js";
import { applyCommand } from "./commands/apply.js";
import { checkCommand } from "./commands/check.js";
import { auditCommand } from "./commands/audit.js";

import { log } from "./utils/logger.js";
import { banner, palette, sym } from "./ui/theme.js";
import { loadConfig, type Config } from "./config.js";
import { getClient } from "./ai/client.js";
import { withSpinner } from "./ui/spinner.js";

function getVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.2.0";
  } catch {
    return "0.2.0";
  }
}

const version = getVersion();

function showHelp() {
  log.blank();
  log.block(
    "Copyshed — UI Copy & House Style Engine",
    [
      `${palette.bold.white("COMMANDS")}`,
      `  ${palette.accent("init".padEnd(22))} Auto-generate brand configuration`,
      `  ${palette.accent("scan [paths]".padEnd(22))} Discover user-facing strings across your code`,
      `  ${palette.accent("check [paths]".padEnd(22))} Verify copy against house rules (exits 1 on failure)`,
      `  ${palette.accent("audit [paths]".padEnd(22))} Score copy for clarity, grade level & psychology`,
      `  ${palette.accent("rewrite [paths]".padEnd(22))} Generate brand-aligned AI suggestions`,
      `  ${palette.accent("apply [--yes]".padEnd(22))} Interactively review and apply proposed patches`,
      `  ${palette.accent("help".padEnd(22))} Show this guide`,
      "",
      `${palette.bold.white("USAGE")}`,
      `  $ copyshed check              ${chalk.dim("# Non-interactive (ideal for CI/CD)")}`,
      `  $ copyshed                    ${chalk.dim("# Launch interactive TUI session")}`,
    ],
    "accent"
  );
  log.blank();
}

/**
 * Direct non-interactive execution for CI/CD and shell scripts.
 */
async function runDirectCommand(args: string[]): Promise<void> {
  const [cmd, ...subArgs] = args;
  const normalized = cmd.toLowerCase().replace(/^\//, "");

  switch (normalized) {
    case "init":
      await initCommand(subArgs);
      process.exit(0);
      break;
    case "scan":
      await scanCommand(subArgs);
      process.exit(0);
      break;
    case "check": {
      const passed = await checkCommand(subArgs);
      process.exit(passed ? 0 : 1);
      break;
    }
    case "audit":
      await auditCommand(subArgs);
      process.exit(0);
      break;
    case "rewrite":
      await rewriteCommand(subArgs);
      process.exit(0);
      break;
    case "apply":
      await applyCommand(subArgs);
      process.exit(0);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      process.exit(0);
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(`copyshed v${version}`);
      process.exit(0);
      break;
    default:
      log.blank();
      log.error(`Unknown command: "${cmd}".`);
      showHelp();
      process.exit(1);
  }
}

/**
 * Interactive REPL session with auto-correction for bare commands.
 */
async function startREPL() {
  console.log("\n" + banner(version) + "\n");

  let config: Config;
  try {
    config = await loadConfig();
    const apiKey =
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log.warn("No AI API key detected in .env. /rewrite will require an API key.");
      log.dim("Commands like /scan, /check, and /audit work completely offline without an API key.");
      log.blank();
    }
  } catch {
    log.error("Could not load config. Run /init to configure this project.");
    log.blank();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: sym.user + " ",
  });

  const messages: { role: "user" | "assistant"; content: string }[] = [];

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const args = input.split(" ").filter(Boolean);
    const rawCmd = args[0].toLowerCase();
    const cmd = rawCmd.startsWith("/") ? rawCmd : `/${rawCmd}`;

    try {
      switch (cmd) {
        case "/init":
          await initCommand(args.slice(1));
          break;
        case "/scan":
          await scanCommand(args.slice(1));
          break;
        case "/rewrite":
          await rewriteCommand(args.slice(1));
          break;
        case "/apply":
          await applyCommand(args.slice(1));
          break;
        case "/check":
          await checkCommand(args.slice(1));
          break;
        case "/audit":
          await auditCommand(args.slice(1));
          break;
        case "/help":
          showHelp();
          break;
        case "/exit":
        case "/quit":
          log.info("Goodbye!");
          process.exit(0);
          break;
        default: {
          // If the input started with a slash and was unrecognized:
          if (rawCmd.startsWith("/")) {
            log.error(`Unknown command: ${rawCmd}. Type /help for available commands.`);
            break;
          }

          // Otherwise, treat as conversational chat with AI Copywriter
          config = await loadConfig();
          const client = getClient(config);

          messages.push({ role: "user", content: input });

          const systemPrompt = `You are Copyshed, an expert Designer-Turned-Copywriter assistant running in a terminal UI.
Your mission is to help the user write, refine, and audit UI copy. Be memorable, creative, and brutally honest about bad copy. Avoid generic AI slop. Give punchy, actionable advice adhering to house style guidelines.`;

          const { result } = await withSpinner("Thinking...", async () => {
            return client.generateChat(systemPrompt, messages, config);
          });

          if (result) {
            messages.push({ role: "assistant", content: result });
            log.blank();
            console.log(result);
            log.blank();
          } else {
            log.error("Received an empty response from the AI model.");
          }
          break;
        }
      }
    } catch (err: any) {
      log.blank();
      log.block("Error", [palette.danger(err.message ?? String(err))], "danger");
      log.blank();
    }

    rl.prompt();
  });

  rl.on("close", () => {
    log.blank();
    log.info("Goodbye!");
    process.exit(0);
  });
}

/**
 * Main application entry point.
 */
async function main() {
  const cliArgs = process.argv.slice(2);

  if (cliArgs.length > 0) {
    await runDirectCommand(cliArgs);
  } else if (!process.stdin.isTTY) {
    showHelp();
    process.exit(0);
  } else {
    await startREPL();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

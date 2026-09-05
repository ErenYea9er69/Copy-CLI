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
import { autoCommand } from "./commands/auto.js";
import { restoreCommand } from "./commands/restore.js";

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
      `  ${palette.accent("auto".padEnd(22))} 100% Autonomous AI overhaul (Scan -> Rewrite -> Backup -> Patch)`,
      `  ${palette.accent("restore [id]".padEnd(22))} Revert modified files to pre-rewrite snapshot`,
      `  ${palette.accent("scan [paths]".padEnd(22))} Discover user-facing strings across code`,
      `  ${palette.accent("audit [paths]".padEnd(22))} Score copy for clarity, grade level & psychology`,
      `  ${palette.accent("check [paths]".padEnd(22))} Verify copy against house rules (exits 1 on failure)`,
      `  ${palette.accent("rewrite [paths]".padEnd(22))} Generate brand-aligned AI suggestions (dry-run)`,
      `  ${palette.accent("apply [--yes]".padEnd(22))} Interactively review and apply proposed patches`,
      `  ${palette.accent("init".padEnd(22))} Auto-generate brand configuration`,
      `  ${palette.accent("help".padEnd(22))} Show this guide`,
      `  ${palette.accent("exit / quit".padEnd(22))} Close the Copyshed session`,
      "",
      `${palette.bold.white("ALWAYS-ON INTERACTIVE MODE")}`,
      "  The session stays active continuously. Run commands with or without '/' prefix,",
      "  or type any question to chat with the AI copywriter assistant.",
    ],
    "accent"
  );
  log.blank();
}

/**
 * Executes a single command string with arguments.
 * Returns boolean indicating if a hard style check passed (for CI).
 */
async function dispatchCommand(rawInput: string): Promise<boolean> {
  const args = rawInput.trim().split(" ").filter(Boolean);
  if (args.length === 0) return true;

  const rawCmd = args[0].toLowerCase();
  const cmd = rawCmd.startsWith("/") ? rawCmd.slice(1) : rawCmd;
  const subArgs = args.slice(1);

  switch (cmd) {
    case "auto":
    case "fix":
      await autoCommand(subArgs);
      return true;
    case "restore":
    case "undo":
    case "rollback":
      await restoreCommand(subArgs);
      return true;
    case "init":
      await initCommand(subArgs);
      return true;
    case "scan":
      await scanCommand(subArgs);
      return true;
    case "check":
      return await checkCommand(subArgs);
    case "audit":
      await auditCommand(subArgs);
      return true;
    case "rewrite":
      await rewriteCommand(subArgs);
      return true;
    case "apply":
      await applyCommand(subArgs);
      return true;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      return true;
    case "version":
    case "--version":
    case "-v":
      console.log(`copyshed v${version}`);
      return true;
    default:
      return false;
  }
}

/**
 * Continuous Always-On REPL session.
 * Stays active until user explicitly enters 'exit' / 'quit' or hits Ctrl+C.
 */
async function startREPL(initialMessage?: string) {
  console.log("\n" + banner(version) + "\n");

  let config: Config;
  try {
    config = await loadConfig();
    const apiKey =
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      log.warn("No AI API key detected in .env. /auto and /rewrite will require an API key.");
      log.dim("Commands like /scan, /check, /audit, and /restore work completely offline.");
      log.blank();
    }
  } catch {
    log.error("Could not load config. Run /init to configure this project.");
    log.blank();
  }

  if (initialMessage) {
    log.info(initialMessage);
    log.blank();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: sym.user + " ",
  });

  const messages: { role: "user" | "assistant"; content: string }[] = [];

  // Graceful Ctrl+C handling
  rl.on("SIGINT", () => {
    log.blank();
    log.info("Session closed (Ctrl+C). Goodbye!");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log.blank();
    log.info("Session closed (Ctrl+C). Goodbye!");
    process.exit(0);
  });

  rl.prompt();

  let isProcessing = false;
  let closeRequested = false;

  rl.on("line", async (line) => {
    isProcessing = true;
    const input = line.trim();
    if (!input) {
      isProcessing = false;
      rl.prompt();
      return;
    }

    const lower = input.toLowerCase();
    if (lower === "exit" || lower === "quit" || lower === "/exit" || lower === "/quit") {
      log.info("Goodbye!");
      process.exit(0);
    }

    try {
      // 1. Try command dispatch
      const handled = await dispatchCommand(input);

      // 2. If not a recognized command, treat as conversational chat with AI assistant
      if (!handled) {
        if (input.startsWith("/")) {
          log.error(`Unknown command: "${input}". Type /help for a list of commands.`);
        } else {
          config = await loadConfig();
          const client = getClient(config);

          messages.push({ role: "user", content: input });

          const systemPrompt = `You are Copyshed, an expert Designer-Turned-Copywriter assistant running in an always-on terminal UI.
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
        }
      }
    } catch (err: any) {
      log.blank();
      log.block("Error", [palette.danger(err.message ?? String(err))], "danger");
      log.blank();
    } finally {
      isProcessing = false;
      if (closeRequested) {
        log.blank();
        log.info("Session closed. Goodbye!");
        process.exit(0);
      }
      rl.prompt();
    }
  });

  rl.on("close", () => {
    if (isProcessing) {
      closeRequested = true;
    } else {
      log.blank();
      log.info("Session closed. Goodbye!");
      process.exit(0);
    }
  });

}

/**
 * Main application entry point.
 */
async function main() {
  const cliArgs = process.argv.slice(2);

  // If arguments were passed via CLI:
  if (cliArgs.length > 0) {
    const isInteractive = Boolean(process.stdin.isTTY);

    if (isInteractive) {
      // Execute the command, then enter the always-on REPL!
      const commandStr = cliArgs.join(" ");
      await dispatchCommand(commandStr);
      await startREPL(`Continuing in always-on session. (Type 'exit' or press Ctrl+C to quit).`);
    } else {
      // Non-interactive execution (CI/CD scripts)
      const passed = await dispatchCommand(cliArgs.join(" "));
      process.exit(passed ? 0 : 1);
    }
  } else {
    // Interactive terminal or piped input stream
    await startREPL();
  }
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});

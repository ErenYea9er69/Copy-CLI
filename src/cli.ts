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
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = getVersion();

function showHelp() {
  log.blank();
  log.block("Copyshed Commands", [
    `${palette.accent("/init".padEnd(20))} ${chalk.dim("Auto-generate a smart configuration file")}`,
    `${palette.accent("/scan [paths]".padEnd(20))} ${chalk.dim("Find user-facing strings in your code")}`,
    `${palette.accent("/rewrite [paths]".padEnd(20))} ${chalk.dim("Generate AI improvements (dry-run mode)")}`,
    `${palette.accent("/apply".padEnd(20))} ${chalk.dim("Apply the safe suggestions from /rewrite")}`,
    `${palette.accent("/check".padEnd(20))} ${chalk.dim("Fail on banned words or em dashes")}`,
    `${palette.accent("/audit".padEnd(20))} ${chalk.dim("Score existing copy for clarity")}`,
    `${palette.accent("/help".padEnd(20))} ${chalk.dim("Show this message")}`,
    `${palette.accent("/exit".padEnd(20))} ${chalk.dim("Quit the Copyshed session")}`,
    "",
    "Or just type any question to chat with your Designer-Turned-Copywriter assistant!",
  ], "accent");
  log.blank();
}

async function startREPL() {
  console.log(`\n${banner(version)}\n`);
  
  // Status bar simulation at startup
  let config: Config;
  try {
    config = await loadConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log.warn("No API key detected in .env. Some commands may fail.");
    }
  } catch (e) {
    log.error("Could not load config. Run /init to set it up.");
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
    const cmd = args[0].toLowerCase();
    
    // Command Router
    try {
      if (cmd.startsWith("/")) {
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
          default:
            log.error(`Unknown command: ${cmd}. Type /help for a list of commands.`);
        }
      } else {
        // Conversational Chat Fallback
        config = await loadConfig();
        const client = getClient(config);
        
        messages.push({ role: "user", content: input });
        
        const systemPrompt = `You are Copyshed, a bold Designer-Turned-Copywriter AI assistant running in a terminal REPL.
Your job is to help the user write, refine, and audit UI copy. Be memorable, creative, and brutally honest about bad copy. Avoid generic AI slop. Give punchy, actionable advice.`;

        const { result } = await withSpinner("Thinking...", async () => {
          return client.generateChat(systemPrompt, messages, config);
        });

        if (result) {
          messages.push({ role: "assistant", content: result });
          log.blank();
          console.log(result);
          log.blank();
        } else {
          log.error("Received an empty response from the model.");
        }
      }
    } catch (err: any) {
      log.blank();
      log.block("Something went wrong", [palette.danger(err.message ?? String(err))], "danger");
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

startREPL().catch((err) => {
  console.error(err);
  process.exit(1);
});

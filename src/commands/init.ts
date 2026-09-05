import { promises as fs } from "node:fs";
import path from "node:path";
import { input, confirm } from "@inquirer/prompts";
import { CONFIG_FILENAME, defaultConfig } from "../config.js";
import { log } from "../utils/logger.js";
import { palette } from "../ui/theme.js";

export async function initCommand(opts: { yes?: boolean }) {
  log.title("Setup", "a few questions, then you're ready to scan");
  log.blank();

  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);

  const exists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    const overwrite = opts.yes ? false : await confirm({ message: `${CONFIG_FILENAME} already exists. Overwrite?`, default: false });
    if (!overwrite) {
      log.info(`Left ${CONFIG_FILENAME} as is.`);
      return;
    }
  }

  const base = defaultConfig();

  if (!opts.yes) {
    base.target_audience = await input({
      message: "Who reads this copy?",
      default: base.target_audience,
    });
    base.brand_voice = await input({
      message: "Describe the brand voice in a few words:",
      default: base.brand_voice,
    });
    base.goals = await input({
      message: "What should this copy accomplish?",
      default: base.goals,
    });
  }

  await fs.writeFile(configPath, JSON.stringify(base, null, 2) + "\n", "utf8");
  log.ok(`Wrote ${CONFIG_FILENAME}`);

  const envPath = path.resolve(process.cwd(), ".env");
  const envExists = await fs
    .access(envPath)
    .then(() => true)
    .catch(() => false);
  if (!envExists) {
    await fs.writeFile(envPath, "ANTHROPIC_API_KEY=\n", "utf8");
    log.ok("Wrote .env (add your Anthropic API key, then keep this file out of version control)");
  }

  log.blank();
  log.panel("You're set up", [
    `1. Put your Anthropic API key in ${palette.accent(".env")}`,
    `2. Run ${palette.accent("copyshed scan")} to see what it finds`,
    `3. Run ${palette.accent("copyshed rewrite")} to generate suggestions`,
  ], "accent");
}

import chalk from "chalk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG_FILENAME, defaultConfig } from "../config.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { getClient } from "../ai/client.js";
import { withSpinner } from "../ui/spinner.js";


export async function initCommand(args: string[]) {
  log.header("init");
  log.blank();

  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const exists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    const backupPath = `${configPath}.bak`;
    await fs.copyFile(configPath, backupPath);
    log.info(`Backed up existing configuration to ${palette.faint(CONFIG_FILENAME + ".bak")}`);
  }

  const base = defaultConfig();
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    log.warn("No AI API key detected in environment.");
    log.dim("Writing default configuration. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env for AI rewrites.");
  } else {
    log.step("Analyzing package.json and README.md to infer project audience and brand voice...");

    let contextStr = "";
    try {
      const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
      contextStr += `Project Name: ${pkg.name}\nDescription: ${pkg.description}\n`;
    } catch {}
    try {
      const readme = await fs.readFile("README.md", "utf8");
      contextStr += `README:\n${readme.slice(0, 1500)}\n`;
    } catch {}

    try {
      const { result } = await withSpinner("Synthesizing brand style profile...", async () => {
        const client = getClient(base);
        const system =
          "You are a senior copywriter. Analyze the provided project context and deduce the best target audience, brand voice, and UI copy goals for this project. Keep it punchy and bold. Return a JSON object with EXACTLY these string keys: target_audience, brand_voice, goals.";
        const userMessage = `Context:\n${contextStr || "(No files found, use smart general defaults)"}\n\nReturn ONLY valid JSON.`;

        const resp = await client.generateText(system, userMessage, base);
        if (resp) {
          const cleaned = resp.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
          return JSON.parse(cleaned);
        }
        return null;
      });

      if (result) {
        if (result.target_audience) base.target_audience = result.target_audience;
        if (result.brand_voice) base.brand_voice = result.brand_voice;
        if (result.goals) base.goals = result.goals;
      }
    } catch (err: any) {
      log.warn(`Context analysis skipped (${err.message}). Using recommended defaults.`);
    }
  }

  await fs.writeFile(configPath, JSON.stringify(base, null, 2) + "\n", "utf8");
  log.ok(`Created ${palette.bold.white(CONFIG_FILENAME)}`);

  log.blank();
  log.block(
    "Configuration Ready",
    [
      `${palette.muted("Audience:")} ${base.target_audience}`,
      `${palette.muted("Voice:")}    ${base.brand_voice}`,
      `${palette.muted("Goals:")}    ${base.goals}`,
      "",
      chalk.dim("Next steps: Run /scan to view strings, or /audit to evaluate readability."),
    ],
    "accent"
  );
  log.blank();
}

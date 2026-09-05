import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG_FILENAME, defaultConfig } from "../config.js";
import { log } from "../utils/logger.js";
import { palette } from "../ui/theme.js";
import { getClient } from "../ai/client.js";
import { withSpinner } from "../ui/spinner.js";

export async function initCommand(args: string[]) {
  log.header("init");

  const configPath = path.resolve(process.cwd(), CONFIG_FILENAME);
  const exists = await fs
    .access(configPath)
    .then(() => true)
    .catch(() => false);
    
  if (exists) {
    const backupPath = `${configPath}.bak`;
    await fs.copyFile(configPath, backupPath);
    log.info(`Backed up existing config to ${palette.faint(CONFIG_FILENAME + ".bak")}`);
  }

  const base = defaultConfig();
  let apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    log.error("No API key found in your environment.");
    log.info("Please set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in your .env file, then restart Copyshed.");
    log.blank();
    return;
  }

  log.step("I will start by analyzing package.json and README.md to infer the brand voice and target audience.");
  
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
    const { result } = await withSpinner("Analyzing project context", async () => {
      const client = getClient(base);
      const system = "You are a senior copywriter. Analyze the provided project context and deduce the best target audience, brand voice, and UI copy goals for this project. Keep it punchy and bold. Return a JSON object with EXACTLY these string keys: target_audience, brand_voice, goals.";
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
    log.warn(`Auto-analysis failed: ${err.message}. Using default values.`);
  }

  await fs.writeFile(configPath, JSON.stringify(base, null, 2) + "\n", "utf8");
  log.ok(`Wrote ${CONFIG_FILENAME}`);

  log.blank();
  log.block("Generated Configuration", [
    `${palette.muted("Audience:")} ${base.target_audience}`,
    `${palette.muted("Voice:")}    ${base.brand_voice}`,
    `${palette.muted("Goals:")}    ${base.goals}`,
  ], "accent");
  log.blank();
}

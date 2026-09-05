import { promises as fs } from "node:fs";
import path from "node:path";
import { input, confirm } from "@inquirer/prompts";
import { CONFIG_FILENAME, defaultConfig } from "../config.js";
import { log } from "../utils/logger.js";
import { palette, sym } from "../ui/theme.js";
import { getClient } from "../ai/client.js";
import { withSpinner } from "../ui/spinner.js";

export async function initCommand(opts: { yes?: boolean }) {
  log.header("init");
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
  let apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  let newlyEnteredKey = false;

  if (!apiKey && !opts.yes) {
    const entered = await input({
      message: "Enter an API key (Anthropic/OpenAI/Gemini) for auto-analysis (or press Enter to use defaults):",
    });
    if (entered.trim()) {
      apiKey = entered.trim();
      newlyEnteredKey = true;
      if (apiKey.startsWith("sk-ant")) {
        process.env.ANTHROPIC_API_KEY = apiKey;
        base.model = "claude-sonnet-5";
      } else if (apiKey.startsWith("AIza")) {
        process.env.GEMINI_API_KEY = apiKey;
        base.model = "gemini-2.5-pro";
      } else {
        process.env.OPENAI_API_KEY = apiKey;
        base.model = "gpt-4o";
      }
    }
  }

  if (apiKey) {
    log.blank();
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
  }

  await fs.writeFile(configPath, JSON.stringify(base, null, 2) + "\n", "utf8");
  log.blank();
  log.ok(`Wrote ${CONFIG_FILENAME}`);

  const envPath = path.resolve(process.cwd(), ".env");
  const envExists = await fs
    .access(envPath)
    .then(() => true)
    .catch(() => false);
    
  if (!envExists) {
    const keyToWrite = newlyEnteredKey && apiKey ? apiKey : "";
    const prefix = newlyEnteredKey && apiKey?.startsWith("AIza") ? "GEMINI_API_KEY" : 
                   newlyEnteredKey && apiKey?.startsWith("sk-ant") ? "ANTHROPIC_API_KEY" : 
                   "OPENAI_API_KEY";
    await fs.writeFile(envPath, `${prefix}=${keyToWrite}\n`, "utf8");
    log.ok(`Wrote .env with your API key`);
  }

  log.blank();
  log.block("Generated Configuration", [
    `${palette.muted("Audience:")} ${base.target_audience}`,
    `${palette.muted("Voice:")}    ${base.brand_voice}`,
    `${palette.muted("Goals:")}    ${base.goals}`,
  ], "accent");

  log.blank();
  log.block("Next steps", [
    `1. Run ${palette.accent("copyshed scan")} to see what it finds`,
    `2. Run ${palette.accent("copyshed rewrite")} to generate suggestions`,
  ], "neutral");
}

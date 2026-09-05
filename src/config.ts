import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";

export const ConfigSchema = z.object({
  target_audience: z.string().default("general product users"),
  brand_voice: z.string().default("plain, direct, and confident"),
  goals: z.string().default("clarity first, then persuasion"),
  extra_banned_words: z.array(z.string()).default([]),
  extra_banned_phrases: z.array(z.string()).default([]),
  include: z
    .array(z.string())
    .default(["src/**/*.{js,jsx,ts,tsx}", "**/locales/**/*.json", "**/i18n/**/*.json"]),
  exclude: z
    .array(z.string())
    .default([
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/*.d.ts",
    ]),
  attribute_allowlist: z
    .array(z.string())
    .default([
      "title",
      "label",
      "placeholder",
      "alt",
      "aria-label",
      "aria-description",
      "description",
      "tooltip",
      "helperText",
      "errorText",
      "buttonText",
    ]),
  key_allowlist: z
    .array(z.string())
    .default([
      "title",
      "label",
      "placeholder",
      "description",
      "message",
      "heading",
      "subtitle",
      "tooltip",
      "error",
      "success",
      "warning",
      "cta",
      "header",
      "footer",
      "body",
      "text",
      "copy",
    ]),
  call_allowlist: z.array(z.string()).default(["t", "i18n.t", "formatMessage", "translate"]),
  model: z.string().default("claude-sonnet-5"),
  max_retries: z.number().int().min(0).max(5).default(2),
  temperature: z.number().min(0).max(1).default(0.4),

  // Context detection: which keys/attributes mark a string as playing a
  // specific psychological role in the interface. A key that matches none
  // of these falls back to the "body" role. See src/rules/psychology.ts
  // for what each role changes about the model's instructions.
  cta_keys: z
    .array(z.string())
    .default(["cta", "buttontext", "button", "submit", "action", "confirm"]),
  error_keys: z.array(z.string()).default(["error", "errortext", "warning"]),
  success_keys: z.array(z.string()).default(["success"]),
  headline_keys: z
    .array(z.string())
    .default(["title", "heading", "header", "subtitle", "h1", "h2", "h3", "h4", "h5", "h6"]),
  label_keys: z
    .array(z.string())
    .default(["label", "placeholder", "tooltip", "helpertext", "alt", "aria-label", "aria-description"]),

  // Target reading grade for body copy (Flesch-Kincaid). Consumer-facing
  // writing advice generally lands between 6th and 9th grade; this is a
  // heuristic ceiling for a warning, not a hard gate.
  reading_level_target: z.number().min(1).max(18).default(8),
});

export type Config = z.infer<typeof ConfigSchema>;

export const CONFIG_FILENAME = "copyshed.config.json";

export async function loadConfig(explicitPath?: string): Promise<Config> {
  const configPath = explicitPath ?? path.resolve(process.cwd(), CONFIG_FILENAME);
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      // No config on disk yet. Fall back to defaults so scan/check still work.
      return ConfigSchema.parse({});
    }
    throw new Error(`Could not read ${configPath}: ${err.message}`);
  }
}

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

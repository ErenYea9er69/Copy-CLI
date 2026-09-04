import { z } from "zod";

/**
 * The config file is the single source of truth for brand voice, audience,
 * and style rules. Every rewrite, lint check, and diff the CLI produces
 * traces back to a field here. Keep this schema small and explicit so a
 * team can review a config change in a pull request the same way they
 * review code.
 */
export const BrandVoiceSchema = z.object({
  tone: z.array(z.string()).min(1).default(["clear", "direct"]),
  formality: z.enum(["casual", "neutral", "formal"]).default("neutral"),
  person: z.enum(["first", "second", "third"]).default("second"),
  allowContractions: z.boolean().default(true),
  sentenceCase: z.boolean().default(true)
});

export const StyleRulesSchema = z.object({
  maxSentenceWords: z.number().int().positive().default(20),
  forbidEmDash: z.boolean().default(true),
  forbidExclamationFiller: z.boolean().default(true),
  forbidPassiveOpeners: z.boolean().default(true),
  maxSemicolonsPerString: z.number().int().nonnegative().default(1)
});

export const AiEngineSchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().default("claude-sonnet-4-6"),
  apiKeyEnv: z.string().default("ANTHROPIC_API_KEY"),
  maxStringsPerBatch: z.number().int().positive().default(25),
  temperature: z.number().min(0).max(1).default(0.2)
});

export const TargetsSchema = z.object({
  jsxText: z.boolean().default(true),
  attributes: z
    .array(z.string())
    .default([
      "placeholder",
      "title",
      "alt",
      "aria-label",
      "label",
      "helperText",
      "buttonText",
      "tooltip",
      "errorMessage",
      "description"
    ]),
  callees: z
    .array(z.string())
    .default(["t", "i18n.t", "toast", "toast.error", "toast.success", "confirm", "alert"])
});

export const ConfigSchema = z.object({
  audience: z.string().default("general users of a web product"),
  goals: z.array(z.string()).default(["reduce ambiguity", "sound consistent across the product"]),
  brandVoice: BrandVoiceSchema.default({}),
  style: StyleRulesSchema.default({}),
  bannedWords: z.array(z.string()).default([]),
  preferredReplacements: z.record(z.string()).default({}),
  rewriteMode: z.enum(["rules", "ai"]).default("rules"),
  ai: AiEngineSchema.default({}),
  targets: TargetsSchema.default({}),
  include: z
    .array(z.string())
    .default(["src/**/*.{js,jsx,ts,tsx}", "locales/**/*.json", "**/*.i18n.json"]),
  exclude: z
    .array(z.string())
    .default(["**/node_modules/**", "**/dist/**", "**/build/**", "**/*.test.*", "**/*.spec.*"])
});

export type Config = z.infer<typeof ConfigSchema>;
export type BrandVoice = z.infer<typeof BrandVoiceSchema>;
export type StyleRules = z.infer<typeof StyleRulesSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

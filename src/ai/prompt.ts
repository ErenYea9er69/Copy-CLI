import { HARD_RULE_DESCRIPTIONS, SOFT_RULE_DESCRIPTIONS, BANNED_WORD_ROOTS, BANNED_PHRASES } from "../rules/writingRules.js";
import type { Config } from "../config.js";
import type { StringCandidate } from "../extract/types.js";

export function buildSystemPrompt(config: Config): string {
  const bannedWords = [...BANNED_WORD_ROOTS, ...config.extra_banned_words].join(", ");
  const bannedPhrases = [...BANNED_PHRASES, ...config.extra_banned_phrases].join("; ");

  return [
    "You rewrite user-facing UI copy for a real product. You do not write about the product in the abstract; you produce the exact replacement string.",
    "",
    `Target audience: ${config.target_audience}`,
    `Brand voice: ${config.brand_voice}`,
    `Product goals for this copy: ${config.goals}`,
    "",
    "Rules that must never be broken:",
    ...HARD_RULE_DESCRIPTIONS.map((r) => `- ${r}`),
    `- Banned words (any tense, any suffix, singular or plural): ${bannedWords}`,
    `- Banned phrases (any form): ${bannedPhrases}`,
    "",
    "Rules to write by, applied with judgment:",
    ...SOFT_RULE_DESCRIPTIONS.map((r) => `- ${r}`),
    "",
    "Keep the rewrite the same kind of string as the original: a button label stays short, an error message stays an error message, a sentence stays a sentence. Preserve meaning and preserve every interpolation placeholder exactly.",
    "",
    "Respond with a single JSON object and nothing else. No markdown fences, no commentary outside the JSON. Shape:",
    '{"rewrite": "the replacement string", "rationale": "one short sentence on what changed and why"}',
  ].join("\n");
}

export function buildUserMessage(candidate: StringCandidate, priorFeedback?: string): string {
  const lines = [
    `Original string: ${JSON.stringify(candidate.value)}`,
    `Found as: ${candidate.source}${candidate.contextName ? ` (${candidate.contextName})` : ""}`,
    `File: ${candidate.file}:${candidate.line}`,
    `Surrounding code: ${candidate.contextSnippet}`,
  ];
  if (priorFeedback) {
    lines.push(
      "",
      "Your previous attempt failed these checks, fix all of them:",
      priorFeedback
    );
  }
  lines.push("", "Return the JSON object now.");
  return lines.join("\n");
}

import { HARD_RULE_DESCRIPTIONS, SOFT_RULE_DESCRIPTIONS, BANNED_WORD_ROOTS, BANNED_PHRASES } from "../rules/writingRules.js";
import { PERSUASION_PRINCIPLES, roleGuidance, type CopyRole } from "../rules/psychology.js";
import type { Config } from "../config.js";
import type { StringCandidate } from "../extract/types.js";

const FEW_SHOT_EXEMPLARS: Record<CopyRole, { before: string; after: string; why: string }> = {
  cta: {
    before: "Submit confirmation of your application",
    after: "Send my application",
    why: "Names the concrete outcome, cuts corporate noun pileup",
  },
  error: {
    before: "You entered an invalid credit card number. Payment failed.",
    after: "Check your card number and try again",
    why: "De-escalates anxiety, offers immediate next step without user blame",
  },
  success: {
    before: "The user settings have been successfully updated in the system.",
    after: "Settings saved",
    why: "Concise, confirmed state in past tense with zero fluff",
  },

  headline: {
    before: "Unlock the power of our comprehensive platform to skyrocket productivity",
    after: "Ship clean product copy in minutes",
    why: "Replaced 4 banned AI buzzwords with a sharp, memorable promise",
  },
  label: {
    before: "Please enter your corporate email address here",
    after: "Work email",
    why: "Glanceable, functional, zero filler words",
  },
  body: {
    before: "There are many different features that can basically be utilized by teams.",
    after: "Your team gets 12 focused tools with zero setup.",
    why: "Replaced vague quantifiers and passive voice with a concrete number",
  },
};

export function buildSystemPrompt(config: Config): string {
  const bannedWords = [...BANNED_WORD_ROOTS, ...config.extra_banned_words].slice(0, 40).join(", ");
  const bannedPhrases = [...BANNED_PHRASES, ...config.extra_banned_phrases].join("; ");

  const exemplarLines = (Object.entries(FEW_SHOT_EXEMPLARS) as [CopyRole, typeof FEW_SHOT_EXEMPLARS[CopyRole]][])
    .map(
      ([role, ex]) =>
        `[Role: ${role}]\n  Before: "${ex.before}"\n  Rewrite: "${ex.after}"\n  Rationale: ${ex.why}`
    )
    .join("\n\n");

  return [
    "You are Copyshed: an elite Designer-Turned-Copywriter. You craft memorable, human-centric, high-converting product copy.",
    "Your objective: Rewrite UI strings to match strict brand voice while maintaining exact software functionality.",
    "",
    `Target Audience: ${config.target_audience}`,
    `Brand Voice: ${config.brand_voice}`,
    `Copywriting Goals: ${config.goals}`,
    "",
    "CRITICAL HARD RULES (ZERO TOLERANCE):",
    ...HARD_RULE_DESCRIPTIONS.map((r) => `- ${r}`),
    `- Banned words (never use in any form): ${bannedWords}, etc.`,
    `- Banned phrases: ${bannedPhrases}`,
    "- Interpolation placeholders (e.g. {name}, {{count}}, %s, ${val}) must be preserved byte-for-byte.",
    "",
    "COPYWRITING PRINCIPLES:",
    ...SOFT_RULE_DESCRIPTIONS.slice(0, 8).map((r) => `- ${r}`),
    "",
    "FEW-SHOT TRANSFORMATIONS (Study these carefully):",
    exemplarLines,
    "",
    "RESPONSE FORMAT:",
    "Return ONLY a JSON object (no markdown fences, no conversational preamble). Format:",
    '{"rewrite": "replacement string", "rationale": "one short punchy sentence explaining the improvement"}',
  ].join("\n");
}

export function buildUserMessage(candidate: StringCandidate, role: CopyRole, priorFeedback?: string): string {
  const lines = [
    `Original String: ${JSON.stringify(candidate.value)}`,
    `Role: ${role.toUpperCase()} — ${roleGuidance(role)}`,
    `Context: ${candidate.source}${candidate.contextName ? ` (${candidate.contextName})` : ""}`,
    `Code Snippet: ${candidate.contextSnippet}`,
  ];

  if (priorFeedback) {
    lines.push(
      "",
      "⚠️ PREVIOUS ATTEMPT FAILED THE FOLLOWING CHECKS. FIX ALL OF THEM:",
      priorFeedback
    );
  }

  lines.push("", "Provide the JSON response now:");
  return lines.join("\n");
}

export function buildBatchSystemPrompt(config: Config): string {
  return [
    buildSystemPrompt(config),
    "",
    "BATCH FORMAT:",
    "When rewriting a batch of candidates, return a JSON array containing an item for each candidate ID:",
    '[{"id": "string-id", "rewrite": "replacement string", "rationale": "one short rationale"}]',
  ].join("\n");
}

export function buildBatchUserMessage(
  batch: Array<{ candidate: StringCandidate; role: CopyRole }>
): string {
  const items = batch.map(({ candidate, role }) => {
    return [
      `ID: ${candidate.id}`,
      `Role: ${role.toUpperCase()}`,
      `Original: ${JSON.stringify(candidate.value)}`,
      `Context: ${candidate.source} in ${candidate.file}`,
    ].join(" | ");
  });

  return [
    `Rewrite these ${batch.length} UI strings. Follow all house style and role guidelines:`,
    "",
    ...items,
    "",
    "Return ONLY the JSON array matching the exact format specified.",
  ].join("\n");
}

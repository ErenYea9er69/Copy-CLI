import { BANNED_WORD_ROOTS, BANNED_PHRASES, EM_DASH_PATTERN, bannedWordPattern } from "./writingRules.js";
import { MANUFACTURED_URGENCY_PATTERNS, CONFIRM_SHAME_PATTERNS, type CopyRole } from "./psychology.js";
import { vagueQuantifierHits } from "./score.js";
import type { RuleViolation } from "../extract/types.js";

/** A rough imperative-verb check for CTA strings: the first word should read like an action, not a noun. Short list on purpose; it exists to catch the common miss ("Submission", "Confirmation") not to police every verb in English. */
const CTA_NOUN_ENDINGS = /^(the\s+)?\w+(tion|ment|ance|ence)\b/i;

/** Phrases that put the blame on the reader rather than describing what happened. */
const BLAME_PATTERNS: RegExp[] = [/\byou\s+(failed|didn'?t|forgot|entered\s+an?\s+invalid)\b/i];

function phrasePattern(phrase: string): RegExp {
  const parts = phrase.split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b${parts.join("\\s+")}\\b`, "i");
}

const WORD_PATTERNS = BANNED_WORD_ROOTS.map((root) => ({ root, pattern: bannedWordPattern(root) }));
const PHRASE_PATTERNS = BANNED_PHRASES.map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));

const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}|\{[^}]+\}|%[sd]|\$\{[^}]+\}/g;

function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((m) => m[0]);
}

/**
 * Runs every hard rule against a piece of copy. Returns one violation per
 * hit, so a string with three banned words gets three separate entries.
 */
export function checkHardRules(text: string): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const { root, pattern } of WORD_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        rule: "banned-word",
        detail: `contains banned word "${match[0]}" (root: ${root})`,
        severity: "error",
      });
    }
  }

  for (const { phrase, pattern } of PHRASE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        rule: "banned-phrase",
        detail: `contains banned phrase "${match[0]}" (listed: ${phrase})`,
        severity: "error",
      });
    }
  }

  if (EM_DASH_PATTERN.test(text)) {
    violations.push({
      rule: "em-dash",
      detail: "contains an em dash or a double hyphen standing in for one",
      severity: "error",
    });
  }

  const semicolonCount = (text.match(/;/g) ?? []).length;
  if (semicolonCount > 1) {
    violations.push({
      rule: "semicolon-count",
      detail: `contains ${semicolonCount} semicolons, the limit is one`,
      severity: "error",
    });
  }

  if (/#\w/.test(text)) {
    violations.push({ rule: "hashtag", detail: "contains a hashtag-style token", severity: "error" });
  }

  if (/\*[^*]+\*|\*\*/.test(text) || /`[^`]+`/.test(text)) {
    violations.push({ rule: "markdown", detail: "contains markdown syntax (asterisks or backticks)", severity: "error" });
  }

  return violations;
}

/**
 * Light heuristics for the rules a script cannot verify with certainty.
 * These come back as warnings, never as blocking errors. Pass the copy's
 * inferred role (see rules/psychology.ts) to unlock the role-specific
 * checks; omit it and only the role-independent checks run.
 */
export function checkSoftRules(text: string, role?: CopyRole): RuleViolation[] {
  const warnings: RuleViolation[] = [];

  if (/!/.test(text)) {
    warnings.push({
      rule: "exclamation-mark",
      detail: "contains an exclamation mark, confirm it earns its place and is not filler enthusiasm",
      severity: "warning",
    });
  }

  const passiveHit = text.match(/\b(is|are|was|were|be|been|being)\s+\w+ed\b/i);
  if (passiveHit) {
    warnings.push({
      rule: "possible-passive-voice",
      detail: `"${passiveHit[0]}" reads like passive voice, check it by hand`,
      severity: "warning",
    });
  }

  const sentenceCount = (text.match(/[.!?]+(\s|$)/g) ?? []).length;
  if (sentenceCount >= 3) {
    const items = text.match(/\b(first|second|third|one|two|three)\b/gi) ?? [];
    if (items.length >= 3) {
      warnings.push({
        rule: "tidy-three-list",
        detail: "reads like a tidy three-item list, confirm the count is intentional",
        severity: "warning",
      });
    }
  }

  if (/\bnot\s+\w+(\s+\w+){0,3},?\s+but\b/i.test(text)) {
    warnings.push({
      rule: "not-x-but-y",
      detail: 'uses the "not X, but Y" pattern, keep this to one or two uses per page',
      severity: "warning",
    });
  }

  if (/let me know if you (need|have)|feel free to reach out|don'?t hesitate to/i.test(text)) {
    warnings.push({
      rule: "sign-off",
      detail: "reads like a sign-off offering further help",
      severity: "warning",
    });
  }

  const vague = vagueQuantifierHits(text);
  if (vague.length > 0) {
    warnings.push({
      rule: "vague-quantifier",
      detail: `uses a vague quantifier (${vague.join(", ")}) where a real number might exist`,
      severity: "warning",
    });
  }

  for (const pattern of MANUFACTURED_URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push({
        rule: "manufactured-urgency",
        detail: "reads like invented urgency, confirm the deadline or scarcity is real before shipping this",
        severity: "warning",
      });
      break;
    }
  }

  for (const pattern of CONFIRM_SHAME_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push({
        rule: "confirm-shame",
        detail: "phrases a decline option as a foolish choice for the reader, this is a known deceptive pattern",
        severity: "warning",
      });
      break;
    }
  }

  if (role === "cta" && CTA_NOUN_ENDINGS.test(text.trim())) {
    warnings.push({
      rule: "cta-not-imperative",
      detail: "this is a call to action but opens with a noun, not a verb naming the outcome",
      severity: "warning",
    });
  }

  if (role === "error") {
    for (const pattern of BLAME_PATTERNS) {
      if (pattern.test(text)) {
        warnings.push({
          rule: "error-blames-reader",
          detail: "puts the fault on the reader instead of describing what happened",
          severity: "warning",
        });
        break;
      }
    }
  }

  return warnings;
}

/**
 * Confirms every placeholder in the original string survives in the
 * rewrite untouched. A missing {name} or %s breaks the running app, so
 * this is a hard rule regardless of what the writing style says.
 */
export function checkPlaceholdersPreserved(original: string, rewrite: string): RuleViolation[] {
  const originalTokens = extractPlaceholders(original);
  if (originalTokens.length === 0) return [];
  const rewriteTokens = new Set(extractPlaceholders(rewrite));
  const missing = originalTokens.filter((t) => !rewriteTokens.has(t));
  if (missing.length === 0) return [];
  return [
    {
      rule: "missing-placeholder",
      detail: `the rewrite drops placeholder(s): ${[...new Set(missing)].join(", ")}`,
      severity: "error",
    },
  ];
}

export function validateRewrite(
  original: string,
  rewrite: string,
  extraBannedWords: string[] = [],
  extraBannedPhrases: string[] = [],
  role?: CopyRole
): { errors: RuleViolation[]; warnings: RuleViolation[] } {
  const errors: RuleViolation[] = [
    ...checkHardRules(rewrite),
    ...checkPlaceholdersPreserved(original, rewrite),
  ];

  for (const word of extraBannedWords) {
    if (bannedWordPattern(word).test(rewrite)) {
      errors.push({ rule: "banned-word-project", detail: `contains project-banned word "${word}"`, severity: "error" });
    }
  }
  for (const phrase of extraBannedPhrases) {
    if (phrasePattern(phrase).test(rewrite)) {
      errors.push({ rule: "banned-phrase-project", detail: `contains project-banned phrase "${phrase}"`, severity: "error" });
    }
  }

  const warnings = checkSoftRules(rewrite, role);
  return { errors, warnings };
}

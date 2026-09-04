/**
 * Core house style for CopyShed.
 *
 * These rules are baked in. A project config can add a target audience,
 * a brand voice, and extra banned words on top of this list, but it cannot
 * remove or weaken anything here. That is what "team style guide
 * enforcement" means in this tool: one shared floor, enforced the same way
 * for every contributor.
 *
 * The rules split into two groups:
 *
 * HARD rules: a machine can check these with certainty. A banned word is
 * present or it is not. An em dash is present or it is not. CopyShed
 * blocks a suggestion that fails a hard rule and sends it back to the
 * model with the specific violation, up to the configured retry count.
 *
 * SOFT rules: these describe good prose (active voice, sentence rhythm,
 * commitment over hedging) but a script cannot verify them with full
 * confidence. CopyShed still puts them in the model's instructions, and
 * it runs light heuristic checks that surface a warning for a human to
 * read, but it does not block a suggestion on a soft rule alone. Say so
 * plainly in the tool so nobody mistakes a warning for a guarantee.
 */

export const HARD_RULE_DESCRIPTIONS: string[] = [
  "Never use an em dash (—) or a double hyphen used as one. Use a comma, a period, or a semicolon instead.",
  "Use at most one semicolon per string.",
  "No markdown syntax: no asterisks, no hashtags, no backticks, no heading markers.",
  "Do not use any word from the banned word list, in any tense, any suffix, singular or plural.",
  "Do not use any phrase from the banned phrase list, in any form.",
];

export const SOFT_RULE_DESCRIPTIONS: string[] = [
  "Write in active voice. Avoid passive voice.",
  "Use short, direct sentences.",
  "Use plain, simple words.",
  "Avoid metaphors and cliches.",
  "State specifics instead of generalizations.",
  "Skip a rhetorical question followed by its own answer.",
  "Vary sentence length on purpose when writing more than one sentence.",
  "Skip tidy three-item lists as a default pattern. Vary the count.",
  "Skip a wrap-up sentence that just restates the point.",
  "Take a side instead of hedging. Do not stack qualifiers in one sentence.",
  "Skip sign-offs that offer further help, e.g. \"let me know if you need anything else.\"",
  "Use the \"not X, but Y\" construction sparingly, at most once or twice in a body of copy.",
  "Write in first person when the copy speaks as a person, not as a system.",
  "Skip exclamation marks used as filler enthusiasm.",
  "Do not force a perfectly balanced pro and con for every claim. Commit to a view when the copy calls for one.",
  "Keep interpolation placeholders exactly as given, e.g. {name}, %s, or {{count}}.",
];

/**
 * Banned words. Stored as roots. The validator matches a root plus any
 * trailing word characters, so "harness" also catches "harnessed",
 * "harnessing", and "harnesses" without listing every inflection.
 */
export const BANNED_WORD_ROOTS: string[] = [
  "can",
  "may",
  "just",
  "that",
  "very",
  "really",
  "literally",
  "probably",
  "basically",
  "could",
  "maybe",
  "massive",
  "delve",
  "embark",
  "esteemed",
  "craft",
  "imagine",
  "unlock",
  "discover",
  "skyrocket",
  "abyss",
  "revolutionize",
  "disruptive",
  "utilize",
  "illuminate",
  "unveil",
  "pivotal",
  "intricate",
  "elucidate",
  "realm",
  "however",
  "harness",
  "exciting",
  "groundbreaking",
  "remarkable",
  "powerful",
  "leverage",
  "tapestry",
  "robust",
  "navigate",
  "landscape",
  "nuanced",
  "streamline",
  "foster",
  "underscore",
  "multifaceted",
  "seamless",
  "ecosystem",
  "comprehensive",
  "facilitate",
  "beacon",
  "tailored",
  "elevate",
];

/**
 * Banned phrases, matched as a whole regardless of internal capitalization
 * or the exact whitespace between words.
 */
export const BANNED_PHRASES: string[] = [
  "shed light",
  "not alone",
  "remains to be seen",
  "glimpse into",
  "in summary",
  "in conclusion",
  "opened up",
  "dive deeper",
];

// U+2014 is the em dash itself. A doubled hyphen is the common plain-text
// stand-in for one, so the validator treats it the same way.
export const EM_DASH_PATTERN = /\u2014|--/;


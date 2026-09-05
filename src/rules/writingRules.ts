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
  "Prefer a concrete number to a vague quantifier when a real one is available: \"700+ teams\" over \"many teams.\"",
  "Never invent urgency or scarcity that is not true: no fake countdowns, no fabricated low-stock claims.",
  "Never phrase a decline option as a foolish or shameful choice for the reader.",
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
  "stark",
  "testament",
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

/**
 * A handful of banned roots are short, common English words that also
 * start a lot of unrelated ones: "can" opens "candidate," "canvas," and
 * "canyon"; "may" opens "mayor" and "mayonnaise"; "that" opens "thatch."
 * None of those carry the meaning the rule is banning, and none of them
 * take a "tense" or a "suffix" in the sense the rule means (there is no
 * banned-in-spirit inflection of the modal "can"). For this short list,
 * match the whole word only. Every other root keeps the wider match, so
 * "harness" still catches "harnessing," "harnessed," and "harnesses."
 */
const EXACT_MATCH_ONLY_ROOTS = new Set(["can", "may", "just", "that", "very"]);

/**
 * Builds the regex that finds one banned root in a string of text.
 * Shared by the validator (blocking check) and the scorer (heuristic
 * score) so the two never quietly drift into disagreeing with each
 * other about what counts as a hit.
 */
export function bannedWordPattern(root: string): RegExp {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (EXACT_MATCH_ONLY_ROOTS.has(root.toLowerCase())) {
    return new RegExp(`\\b${escaped}\\b`, "i");
  }
  // English drops a trailing silent e before "-ing": "utilize" becomes
  // "utilizing," not "utilizeing." A plain substring match on the root
  // misses that entire inflection for every verb ending in e (utilize,
  // navigate, elevate, imagine, delve, and more), so this branch adds
  // the dropped-e spelling as a second way to match.
  if (/e$/i.test(root)) {
    const stem = escaped.slice(0, -1);
    return new RegExp(`\\b(?:${escaped}\\w*|${stem}ing\\w*)`, "i");
  }
  // Word boundary, the root, then any trailing word characters, to catch
  // plural and tense suffixes ("harness" -> "harnessing", "harnessed").
  return new RegExp(`\\b${escaped}\\w*`, "i");
}


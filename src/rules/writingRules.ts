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
 * HARD rules: a machine can check these with certainty.
 * SOFT rules: these describe good prose, boldness, and character.
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
  "Use short, punchy sentences.",
  "Make it unforgettable. What is the one thing someone will remember?",
  "Be bold and intentional. If the tone is minimal, be brutally minimal. If playful, be remarkably playful.",
  "Avoid generic AI aesthetics. Surprise the reader with creative, human-centric phrasing.",
  "State specifics instead of generalizations.",
  "Skip tidy three-item lists as a default pattern. Vary the count.",
  "Take a side instead of hedging. Do not stack qualifiers in one sentence.",
  "Use the \"not X, but Y\" construction sparingly.",
  "Write in first person when the copy speaks as a person, not as a system.",
  "Skip exclamation marks used as filler enthusiasm.",
  "Do not force a perfectly balanced pro and con for every claim. Commit to a view.",
  "Keep interpolation placeholders exactly as given, e.g. {name}, %s, or {{count}}.",
  "Prefer a concrete number to a vague quantifier: \"700+ teams\" over \"many teams.\"",
  "Never invent urgency or scarcity that is not true.",
  "Never phrase a decline option as a foolish or shameful choice.",
];

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
  "unleash",
  "supercharge",
];

export const BANNED_PHRASES: string[] = [
  "shed light",
  "not alone",
  "remains to be seen",
  "glimpse into",
  "in summary",
  "in conclusion",
  "opened up",
  "dive deeper",
  "game changer",
];

export const EM_DASH_PATTERN = /\u2014|--/;

const EXACT_MATCH_ONLY_ROOTS = new Set(["can", "may", "just", "that", "very"]);

export function bannedWordPattern(root: string): RegExp {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (EXACT_MATCH_ONLY_ROOTS.has(root.toLowerCase())) {
    return new RegExp(`\\b${escaped}\\b`, "i");
  }
  if (/e$/i.test(root)) {
    const stem = escaped.slice(0, -1);
    return new RegExp(`\\b(?:${escaped}\\w*|${stem}ing\\w*)`, "i");
  }
  return new RegExp(`\\b${escaped}\\w*`, "i");
}

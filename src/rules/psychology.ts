import type { Config } from "../config.js";
import type { StringCandidate } from "../extract/types.js";

export type CopyRole = "cta" | "error" | "success" | "headline" | "label" | "body";

const ROLE_GUIDANCE: Record<CopyRole, string> = {
  cta: [
    "This string is a call to action. The reader decides here.",
    "Name the outcome, not the mechanism: \"Get my report\" beats \"Submit.\"",
    "Provide the 'Aha!' moment. Make the action irresistible.",
    "One short verb phrase. No exclamation mark standing in for energy the copy has not earned.",
  ].join(" "),
  error: [
    "This string is an error message. The reader is already stuck.",
    "De-escalate anxiety while offering immediate redemption.",
    "State what happened in plain words, state one next step, and do not blame the reader for it.",
    "One clear sentence beats a paragraph of apology.",
  ].join(" "),
  success: [
    "This string confirms something already happened. Past tense, plain words.",
    "Make the success feel earned, but keep it concise.",
  ].join(" "),
  headline: [
    "This string gets scanned, not read word for word.",
    "Be bold. Lead with the single most concrete, striking claim in the string.",
    "Cut any word that would be equally true of a competitor's product.",
  ].join(" "),
  label: [
    "This string is a functional label the reader glances at mid-task, not persuasive copy.",
    "Say exactly what is expected, in as few words as the format allows.",
  ].join(" "),
  body: [
    "This string is running prose. Vary sentence length so attention does not flatten out.",
    "Front-load the important word in each sentence.",
    "Surprise the reader with unexpected, characterful phrasing instead of corporate speak.",
  ].join(" "),
};

export const PERSUASION_PRINCIPLES: string[] = [
  "Cognitive fluency: the plain, common word reads faster and gets trusted more than its fancier synonym.",
  "Loss aversion: a reader weighs a loss roughly twice as heavy as an equal-sized gain.",
  "B=MAP: an action happens when motivation, ability, and a prompt land at the same moment. Copy can supply the prompt and lower the ability bar. It cannot fake motivation.",
  "Real trust signals (a specific number, a named result) move a decision. An invented one erodes trust.",
];

export const MANUFACTURED_URGENCY_PATTERNS: RegExp[] = [
  /\bhurry\b/i,
  /\bact now\b/i,
  /\bdon'?t miss out\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\blimited time\b/i,
  /\bspots?\s+(remaining|left)\b/i,
  /\bwhile\s+(it|they)\s+lasts?\b/i,
];

export const CONFIRM_SHAME_PATTERNS: RegExp[] = [
  /\bno,?\s+i\s+(don'?t|do not)\s+(want|like|need)\b/i,
  /\bno\s+thanks?,?\s+i\s+(prefer|enjoy|like)\b/i,
  /\bi'?d\s+rather\s+(overpay|pay full price|miss out|stay unprotected)\b/i,
];

function lastKeySegment(contextName?: string): string {
  if (!contextName) return "";
  const parts = contextName.split(".");
  return parts[parts.length - 1].toLowerCase();
}

export function inferRole(candidate: StringCandidate, config: Config): CopyRole {
  const key = lastKeySegment(candidate.contextName);
  if (!key) return "body";

  if (config.cta_keys.includes(key)) return "cta";
  if (config.error_keys.includes(key)) return "error";
  if (config.success_keys.includes(key)) return "success";
  if (config.headline_keys.includes(key)) return "headline";
  if (config.label_keys.includes(key)) return "label";
  return "body";
}

export function roleGuidance(role: CopyRole): string {
  return ROLE_GUIDANCE[role];
}

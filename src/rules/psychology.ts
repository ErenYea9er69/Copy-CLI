/**
 * The house style rules in writingRules.ts keep copy from reading badly.
 * They do not tell the model what a string is FOR. A button, an error
 * message, and a headline all fail for different reasons even when they
 * all pass the grammar check, so a single generic prompt flattens them
 * into the same voice. This module gives each one a job description.
 *
 * The roles and the guidance below are not invented from scratch. They
 * compress a small set of well-tested findings:
 *
 * - Nielsen Norman Group's error-message guidelines call for language a
 *   person can read at a glance, a precise account of what went wrong,
 *   one constructive next step, and no blame placed on the reader.
 * - A widely cited button-copy test from Unbounce (Michael Aagaard) found
 *   that switching a CTA from second person ("Start your free trial") to
 *   first person ("Start my free trial") lifted clicks by roughly ninety
 *   percent; later replications land in a smaller but still real range.
 * - Nielsen Norman Group's research on how people read on screens found
 *   that most visitors scan a minority of the words on a page, which is
 *   why the first few words of a heading carry most of the weight.
 * - BJ Fogg's B=MAP model treats an action as the product of motivation,
 *   ability, and a prompt landing at the same moment. Copy can supply
 *   the prompt and lower the ability bar (fewer steps, plainer words).
 *   It cannot manufacture motivation that the reader does not have, and
 *   trying to fake that is where persuasive writing turns into a
 *   deceptive pattern instead.
 * - Robert Cialdini's principles of influence (reciprocity, commitment,
 *   social proof, authority, liking, scarcity, unity) describe how real
 *   trust signals move a decision. They describe a floor, not a license
 *   to invent a signal that is not true.
 * - Harry Brignull's cataloguing of deceptive patterns (his own newer
 *   term for what he first called dark patterns) names manufactured
 *   urgency and confirm-shaming as two of the most common tricks in
 *   commercial UI copy. Both get flagged here, not enforced by regex
 *   alone, because a human still has to confirm the claim is true.
 */

import type { Config } from "../config.js";
import type { StringCandidate } from "../extract/types.js";

export type CopyRole = "cta" | "error" | "success" | "headline" | "label" | "body";

const ROLE_GUIDANCE: Record<CopyRole, string> = {
  cta: [
    "This string is a call to action. The reader decides here.",
    "Name the outcome, not the mechanism: \"Get my report\" beats \"Submit.\"",
    "Default to first person (\"my\") over second person (\"your\") when the brand voice allows it. A well-known button-copy test found first person lifted clicks by a wide margin over the same button in second person.",
    "One short verb phrase. No exclamation mark standing in for energy the copy has not earned.",
  ].join(" "),
  error: [
    "This string is an error message. The reader is already stuck.",
    "State what happened in plain words, state one next step, and do not blame the reader for it.",
    "\"The upload failed. Check your connection and try again\" beats \"You uploaded an invalid file.\"",
    "One clear sentence beats a paragraph of apology or context the reader did not ask for.",
  ].join(" "),
  success: [
    "This string confirms something already happened. Past tense, plain words.",
    "Skip celebration language unless the brand voice explicitly calls for it.",
  ].join(" "),
  headline: [
    "This string gets scanned, not read word for word.",
    "Lead with the single most concrete claim in the string: a number or a named result beats an adjective.",
    "Cut any word that would be equally true of a competitor's product.",
  ].join(" "),
  label: [
    "This string is a functional label the reader glances at mid-task, not persuasive copy.",
    "Say exactly what is expected, in as few words as the format allows. Do not sell inside a form field.",
  ].join(" "),
  body: [
    "This string is running prose. Vary sentence length so attention does not flatten out.",
    "Front-load the important word in each sentence; a reader's eye slows at the start of a line and skims the rest.",
  ].join(" "),
};

export const PERSUASION_PRINCIPLES: string[] = [
  "Cognitive fluency: the plain, common word reads faster and gets trusted more than its fancier synonym. When two words mean the same thing, pick the shorter one.",
  "Loss aversion: a reader weighs a loss roughly twice as heavy as an equal-sized gain. Naming what is actually at risk can carry more weight than naming the upside, as long as the risk is real.",
  "B=MAP: an action happens when motivation, ability, and a prompt land at the same moment. Copy can supply the prompt and lower the ability bar. It cannot fake motivation that is not there.",
  "Real trust signals (a specific number, a named result, an honest deadline) move a decision. An invented one erodes trust the moment the reader notices, and readers notice.",
];

/** Phrases that usually signal invented urgency rather than a real deadline. A human still has to check the claim is true; this only flags the pattern. */
export const MANUFACTURED_URGENCY_PATTERNS: RegExp[] = [
  /\bhurry\b/i,
  /\bact now\b/i,
  /\bdon'?t miss out\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\blimited time\b/i,
  /\bspots?\s+(remaining|left)\b/i,
  /\bwhile\s+(it|they)\s+lasts?\b/i,
];

/** Confirm-shaming: an opt-out phrased as an insult to the reader for declining. */
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

/**
 * Infers the psychological role of a candidate from its config-driven key
 * lists. This is a heuristic, not a parser of intent: a project with an
 * unusual naming scheme should override cta_keys/error_keys/etc in
 * copyshed.config.json rather than fight the defaults. Unmatched strings
 * fall back to "body", the safest generic default.
 */
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

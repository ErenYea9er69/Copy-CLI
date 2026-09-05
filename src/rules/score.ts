/**
 * Heuristic scoring for copy. Nothing here is a certified readability
 * library and nothing here predicts a real conversion rate. A regex and a
 * syllable count cannot know if a claim is true or if a joke lands. Treat
 * the number as a smoke alarm, not a verdict: it catches the obvious
 * failures (a 40-word sentence, a wall of vague quantifiers, a reading
 * grade a general audience will not sit through) so a human can spend
 * review time on the things a script cannot judge, like whether the
 * rewrite is actually persuasive. Say this plainly to whoever reads the
 * score, so nobody mistakes a heuristic for a guarantee.
 */

import { BANNED_WORD_ROOTS, EM_DASH_PATTERN, bannedWordPattern } from "./writingRules.js";

const VAGUE_QUANTIFIERS = [
  "many",
  "several",
  "various",
  "numerous",
  "a lot of",
  "lots of",
  "tons of",
  "a number of",
  "a range of",
  "some",
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(text: string): string[] {
  return text.match(/[A-Za-z']+/g) ?? [];
}

/** Approximate syllable count by counting vowel groups, with a small correction for a silent trailing e. This is the same shortcut most lightweight readability tools use; it drifts on edge cases but tracks well in aggregate. */
function countSyllables(word: string): number {
  const w = word.toLowerCase();
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:es|ed|e)$/, "");
  const groups = stripped.match(/[aeiouy]+/g) ?? [];
  return Math.max(1, groups.length);
}

export interface ReadabilityStats {
  sentences: number;
  words: number;
  syllables: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
}

export function readabilityStats(text: string): ReadabilityStats {
  const sentences = Math.max(1, splitSentences(text).length);
  const words = splitWords(text);
  const wordCount = Math.max(1, words.length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wordsPerSentence = wordCount / sentences;
  const syllablesPerWord = syllables / wordCount;

  const fleschReadingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschKincaidGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;

  return {
    sentences,
    words: wordCount,
    syllables,
    fleschReadingEase,
    fleschKincaidGrade: Math.max(0, fleschKincaidGrade),
  };
}

export function vagueQuantifierHits(text: string): string[] {
  const lower = text.toLowerCase();
  return VAGUE_QUANTIFIERS.filter((q) => new RegExp(`\\b${q}\\b`).test(lower));
}

export function numericMentionCount(text: string): number {
  return (text.match(/\d+([.,]\d+)?%?/g) ?? []).length;
}

export function passiveVoiceHits(text: string): number {
  return (text.match(/\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi) ?? []).length;
}

export interface ClarityScore {
  score: number; // 0-100, higher is easier to read and more concrete
  grade: "A" | "B" | "C" | "D" | "F";
  readingGrade: number;
  vagueHits: number;
  numericMentions: number;
  passiveHits: number;
  bannedWordHits: number;
  hasEmDash: boolean;
}

function bannedWordHitCount(text: string): number {
  return BANNED_WORD_ROOTS.reduce((count, root) => {
    const matches = text.match(new RegExp(bannedWordPattern(root).source, "gi"));
    return count + (matches?.length ?? 0);
  }, 0);
}

function letterGrade(score: number): ClarityScore["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Rolls the individual heuristics into one 0-100 number so a report or a
 * CLI table has something scannable to sort by. The weights are opinions,
 * not a validated model; adjust them in one place if a team's real A/B
 * results say otherwise.
 */
export function clarityScore(text: string, readingLevelTarget: number = 8): ClarityScore {
  const { fleschKincaidGrade } = readabilityStats(text);
  const vague = vagueQuantifierHits(text);
  const numeric = numericMentionCount(text);
  const passive = passiveVoiceHits(text);
  const bannedHits = bannedWordHitCount(text);
  const hasEmDash = EM_DASH_PATTERN.test(text);

  let score = 100;
  score -= bannedHits * 12;
  score -= hasEmDash ? 8 : 0;
  score -= passive * 6;
  score -= vague.length * 8;

  // Flesch-Kincaid was built and validated on paragraphs, not isolated
  // words. A four-syllable button label ("Confirmation") produces a
  // wildly inflated grade with nothing wrong with the copy, so the
  // reading-grade penalty only kicks in once there is enough text for
  // the formula's sentence-length term to mean anything.
  const words = splitWords(text).length;
  if (words >= 6) {
    const gradeOver = Math.max(0, fleschKincaidGrade - readingLevelTarget);
    score -= gradeOver * 4;
  }
  score += Math.min(10, numeric * 4); // reward concrete numbers, capped

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    grade: letterGrade(score),
    readingGrade: Math.round(fleschKincaidGrade * 10) / 10,
    vagueHits: vague.length,
    numericMentions: numeric,
    passiveHits: passive,
    bannedWordHits: bannedHits,
    hasEmDash,
  };
}

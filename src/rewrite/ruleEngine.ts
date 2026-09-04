import type { Config } from "../config/schema.js";
import type { CopyString } from "../extract/types.js";
import type { RewriteResult } from "./types.js";

const CONTRACTION_EXPANSIONS: Record<string, string> = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "won't": "will not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "it's": "it is",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i'm": "I am",
  "you'll": "you will",
  "we'll": "we will",
  "you've": "you have",
  "we've": "we have",
  "there's": "there is",
  "let's": "let us"
};

// Common filler phrases picked up from generic AI-drafted or boilerplate
// product copy. Each entry is a direct, safe, meaning-preserving trim.
const FILLER_TRIMS: Array<[RegExp, string]> = [
  [/^in order to /i, "To "],
  [/^please note that /i, "Note: "],
  [/^we are excited to announce /i, "Announcing "],
  [/^we're excited to announce /i, "Announcing "],
  [/^simply /i, ""],
  [/^just simply /i, ""],
  [/^please be aware that /i, ""],
  [/ in order to /gi, " to "],
  [/ at this point in time/gi, " now"],
  [/ due to the fact that/gi, " because"]
];

const GENERIC_UI_PHRASES: Record<string, string> = {
  "oops! something went wrong": "That did not work",
  "something went wrong": "That did not work",
  "an error occurred": "That did not work",
  "please try again later": "Try again",
  welcome: "Welcome",
  "get started": "Get started",
  "click here": "View details",
  "loading...": "Loading"
};

function capitalizeFirst(text: string): string {
  if (!text) return text;
  const firstLetterIndex = text.search(/[a-zA-Z]/);
  if (firstLetterIndex === -1) return text;
  return (
    text.slice(0, firstLetterIndex) +
    text[firstLetterIndex]!.toUpperCase() +
    text.slice(firstLetterIndex + 1)
  );
}

function collapseSemicolons(text: string, max: number): string {
  const parts = text.split(";");
  if (parts.length - 1 <= max) return text;
  let out = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    if (i <= max) {
      out += ";" + parts[i];
    } else {
      out += ". " + capitalizeFirst(parts[i]!.trim());
    }
  }
  return out;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function replaceWholeWord(text: string, word: string, replacement: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  return text.replace(re, replacement);
}

export function rewriteWithRules(copy: CopyString, config: Config): RewriteResult {
  const reasons: string[] = [];
  const violations: string[] = [];
  let text = copy.text;
  const original = text;

  // 1. Direct team-defined replacements take priority over everything else.
  for (const [from, to] of Object.entries(config.preferredReplacements)) {
    if (new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
      text = replaceWholeWord(text, from, to);
      reasons.push(`replaced preferred term "${from}" -> "${to}"`);
    }
  }

  // 2. Banned words: swap for the closest neutral phrasing, or flag if no
  // safe automatic replacement exists (left to lint mode to surface).
  for (const banned of config.bannedWords) {
    const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      violations.push(`contains banned word "${banned}" (no automatic replacement configured)`);
    }
  }

  // 3. Generic boilerplate phrase swaps.
  const lowerTrimmed = text.trim().toLowerCase();
  if (GENERIC_UI_PHRASES[lowerTrimmed]) {
    text = GENERIC_UI_PHRASES[lowerTrimmed]!;
    reasons.push("replaced generic boilerplate phrase");
  }

  // 4. Filler phrase trims.
  for (const [pattern, replacement] of FILLER_TRIMS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      reasons.push(`trimmed filler phrase matching ${pattern}`);
    }
  }

  // 5. Em dash policy.
  if (config.style.forbidEmDash && /—|--/.test(text)) {
    text = text.replace(/\s*—\s*/g, ", ").replace(/\s*--\s*/g, ", ");
    reasons.push("replaced em dash with comma");
  }

  // 6. Semicolon budget.
  const semicolonLimit = config.style.maxSemicolonsPerString;
  if ((text.match(/;/g) || []).length > semicolonLimit) {
    text = collapseSemicolons(text, semicolonLimit);
    reasons.push(`reduced semicolons to configured max of ${semicolonLimit}`);
  }

  // 7. Exclamation filler.
  if (config.style.forbidExclamationFiller) {
    const playful = config.brandVoice.tone.some((t) =>
      ["playful", "energetic", "fun", "enthusiastic"].includes(t.toLowerCase())
    );
    if (!playful && /!+$/.test(text.trim())) {
      text = text.trim().replace(/!+$/, ".");
      reasons.push("removed filler exclamation mark for a neutral/direct tone");
    } else if (/!{2,}/.test(text)) {
      text = text.replace(/!{2,}/g, "!");
      reasons.push("collapsed repeated exclamation marks");
    }
  }

  // 8. Contractions.
  if (!config.brandVoice.allowContractions) {
    for (const [contraction, expansion] of Object.entries(CONTRACTION_EXPANSIONS)) {
      const re = new RegExp(`\\b${contraction}\\b`, "gi");
      if (re.test(text)) {
        text = text.replace(re, (match) =>
          match[0] === match[0]!.toUpperCase()
            ? expansion[0]!.toUpperCase() + expansion.slice(1)
            : expansion
        );
        reasons.push(`expanded contraction "${contraction}" (contractions disabled)`);
      }
    }
  }

  // 9. Sentence case.
  if (config.brandVoice.sentenceCase) {
    const capped = capitalizeFirst(text);
    if (capped !== text) {
      text = capped;
      reasons.push("capitalized first letter to match sentence case");
    }
  }

  // 10. Collapse double spaces introduced by the trims above.
  const collapsed = text.replace(/ {2,}/g, " ").trim();
  if (collapsed !== text) {
    text = collapsed;
  }

  const exceedsMaxWords = wordCount(text) > config.style.maxSentenceWords;
  if (exceedsMaxWords) {
    violations.push(`exceeds max sentence length (${wordCount(text)} > ${config.style.maxSentenceWords} words)`);
  }

  return {
    source: copy,
    rewritten: text,
    changed: text !== original,
    reasons,
    violations,
    exceedsMaxWords,
    engine: "rules"
  };
}

export function rewriteAllWithRules(strings: CopyString[], config: Config): RewriteResult[] {
  return strings.map((s) => rewriteWithRules(s, config));
}

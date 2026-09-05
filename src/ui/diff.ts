import { diffWords } from "diff";
import chalk from "chalk";
import { sym } from "./theme.js";

/**
 * Inline diff: unchanged text dim, removals struck through, additions underlined.
 * Used in compact contexts where a single line suffices.
 */
export function renderInlineDiff(before: string, after: string): string {
  const parts = diffWords(before, after);
  return parts
    .map((part) => {
      if (part.added) return chalk.green.underline(part.value);
      if (part.removed) return chalk.red.strikethrough(part.value);
      return part.value;
    })
    .join("");
}

/**
 * Two-line "before / after" diff for review.
 * Dim unchanged portions, highlight only the changed words
 * with color + underline (no background blocks for cleaner look).
 * Uses `─` gutter markers for a minimal aesthetic.
 */
export function renderReviewDiff(before: string, after: string): string {
  const parts = diffWords(before, after);

  const beforeLine = parts
    .filter((p) => !p.added)
    .map((p) => (p.removed ? chalk.red.underline(p.value) : chalk.dim(p.value)))
    .join("");

  const afterLine = parts
    .filter((p) => !p.removed)
    .map((p) => (p.added ? chalk.green.underline(p.value) : chalk.white(p.value)))
    .join("");

  const minus = chalk.red(sym.dash);
  const plus = chalk.green(sym.dash);

  return [`  ${minus} ${beforeLine}`, `  ${plus} ${afterLine}`].join("\n");
}

import { diffWords } from "diff";
import chalk from "chalk";

/** Single-line inline diff: unchanged text plain, removals struck through, additions underlined. Used in compact contexts like tables. */
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
 * Two-line "before / after" review diff, gutter-marked like a unified diff,
 * with background highlights on the specific words that changed. This is
 * easier to scan than a single inline line once a rewrite touches more
 * than a couple of words.
 */
export function renderReviewDiff(before: string, after: string): string {
  const parts = diffWords(before, after);

  const beforeLine = parts
    .filter((p) => !p.added)
    .map((p) => (p.removed ? chalk.bgRed.white(p.value) : chalk.dim(p.value)))
    .join("");

  const afterLine = parts
    .filter((p) => !p.removed)
    .map((p) => (p.added ? chalk.bgGreen.black(p.value) : chalk.white(p.value)))
    .join("");

  const minus = chalk.red.bold("−");
  const plus = chalk.green.bold("+");

  return [`${minus} ${beforeLine}`, `${plus} ${afterLine}`].join("\n");
}

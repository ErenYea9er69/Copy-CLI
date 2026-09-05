import { diffWords } from "diff";
import chalk from "chalk";
import { sym, palette } from "./theme.js";

/**
 * Inline diff: unchanged text dim, removals struck through, additions underlined & bold.
 * Used in compact contexts where a single line suffices.
 */
export function renderInlineDiff(before: string, after: string): string {
  const parts = diffWords(before, after);
  return parts
    .map((part) => {
      if (part.added) return palette.success.underline.bold(part.value);
      if (part.removed) return palette.danger.strikethrough(part.value);
      return chalk.dim(part.value);
    })
    .join("");
}

/**
 * Two-line "before / after" diff for review.
 * Dim unchanged portions, highlight changed words with distinct symbols and styling.
 * Never relies on color alone: uses distinct gutter markers ([-] and [+]).
 */
export function renderReviewDiff(before: string, after: string): string {
  const parts = diffWords(before, after);

  const beforeLine = parts
    .filter((p) => !p.added)
    .map((p) => (p.removed ? palette.danger.strikethrough.bold(p.value) : chalk.dim(p.value)))
    .join("");

  const afterLine = parts
    .filter((p) => !p.removed)
    .map((p) => (p.added ? palette.success.underline.bold(p.value) : chalk.white(p.value)))
    .join("");

  const minusMarker = palette.danger.bold(`${sym.minus} `);
  const plusMarker = palette.success.bold(`${sym.plus} `);

  return [
    `  ${minusMarker}${beforeLine}`,
    `  ${plusMarker}${afterLine}`,
  ].join("\n");
}

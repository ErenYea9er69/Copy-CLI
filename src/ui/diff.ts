import { diffWords } from "diff";
import chalk from "chalk";

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

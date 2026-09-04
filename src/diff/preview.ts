import { diffWordsWithSpace, type Change } from "diff";
import chalk from "chalk";
import { relative } from "node:path";
import type { RewriteResult } from "../rewrite/types.js";

function tokenOverlapRatio(before: string, after: string): number {
  const beforeTokens = before.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const afterTokens = new Set((after.toLowerCase().match(/[a-z0-9']+/g) ?? []));
  if (beforeTokens.length === 0) return 1;
  const shared = beforeTokens.filter((t) => afterTokens.has(t)).length;
  return shared / beforeTokens.length;
}

function renderInlineDiff(before: string, after: string): string {
  // When the rewrite shares little vocabulary with the original, a
  // word-level diff interleaves red/green fragments in a way that reads as
  // noise rather than a diff. Fall back to two plain before/after lines.
  if (tokenOverlapRatio(before, after) < 0.4) {
    return `${chalk.red.strikethrough(before)}\n    ${chalk.green(after)}`;
  }
  const parts = diffWordsWithSpace(before, after);
  return parts
    .map((part: Change) => {
      if (part.added) return chalk.green(part.value);
      if (part.removed) return chalk.red.strikethrough(part.value);
      return chalk.dim(part.value);
    })
    .join("");
}

export function printPreview(results: RewriteResult[], cwd: string): { changed: number; flagged: number } {
  const changedResults = results.filter((r) => r.changed);
  const flaggedOnly = results.filter((r) => !r.changed && r.violations.length > 0);

  if (changedResults.length === 0 && flaggedOnly.length === 0) {
    console.log(chalk.dim("No copy changes or violations found."));
    return { changed: 0, flagged: 0 };
  }

  let lastFile = "";
  for (const result of changedResults) {
    const relPath = relative(cwd, result.source.file);
    if (relPath !== lastFile) {
      console.log("\n" + chalk.bold.underline(relPath));
      lastFile = relPath;
    }
    console.log(
      `  ${chalk.cyan(`L${result.source.line}`)} ${chalk.dim(`[${result.source.kind}:${result.source.context}]`)}`
    );
    console.log(`    ${renderInlineDiff(result.source.text, result.rewritten)}`);
    for (const reason of result.reasons) {
      console.log(`    ${chalk.dim("↳")} ${chalk.dim(reason)}`);
    }
    for (const violation of result.violations) {
      console.log(`    ${chalk.yellow("!")} ${violation}`);
    }
  }

  if (flaggedOnly.length > 0) {
    console.log("\n" + chalk.bold.yellow("Flagged, no automatic fix available:"));
    lastFile = "";
    for (const result of flaggedOnly) {
      const relPath = relative(cwd, result.source.file);
      if (relPath !== lastFile) {
        console.log(chalk.underline(relPath));
        lastFile = relPath;
      }
      console.log(`  ${chalk.cyan(`L${result.source.line}`)} "${result.source.text}"`);
      for (const violation of result.violations) {
        console.log(`    ${chalk.yellow("!")} ${violation}`);
      }
    }
  }

  console.log(
    "\n" +
      chalk.bold(
        `${changedResults.length} string(s) would change, ${
          results.filter((r) => r.violations.length > 0).length
        } flagged for manual review.`
      )
  );

  return { changed: changedResults.length, flagged: flaggedOnly.length };
}

import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { renderReviewDiff } from "./diff.js";
import { palette, sym, progressBar } from "./theme.js";
import type { RewriteResult } from "../extract/types.js";

export type ReviewChoice = "accept" | "edit" | "skip" | "accept-all-clean" | "quit";

const STATUS_BADGE: Record<RewriteResult["status"], string> = {
  ok: palette.success(`${sym.tick} clean`),
  needs_review: palette.danger(`${sym.cross} needs review`),
  unchanged: chalk.dim(`${sym.line} unchanged`),
  failed: palette.warn(`${sym.warn} failed`),
};

export async function reviewOne(result: RewriteResult, index: number, total: number): Promise<{ choice: ReviewChoice; edited?: string }> {
  const { candidate } = result;
  console.log("");
  console.log(chalk.dim("─".repeat(Math.min(process.stdout.columns || 80, 72))));

  const roleTag = result.role ? palette.accent(` [${result.role}]`) : "";
  const location = chalk.dim(`${candidate.file}:${candidate.line}`);
  const sourceTag = chalk.dim(`(${candidate.source}${candidate.contextName ? " " + candidate.contextName : ""})`);
  console.log(`${progressBar(index + 1, total, 12)}  ${chalk.dim(`${index + 1}/${total}`)}  ${location} ${sourceTag}${roleTag}`);
  console.log(`  ${STATUS_BADGE[result.status]}`);
  console.log("");
  console.log(renderReviewDiff(candidate.value, result.rewrite));

  if (result.rationale) console.log(chalk.dim(`  ${sym.info} ${result.rationale}`));
  if (result.scoreBefore != null && result.scoreAfter != null) {
    const delta = result.scoreAfter - result.scoreBefore;
    const deltaText = delta > 0 ? palette.success(`+${delta}`) : delta < 0 ? palette.danger(`${delta}`) : chalk.dim("+0");
    console.log(chalk.dim(`  clarity score: ${result.scoreBefore} -> ${result.scoreAfter} (${deltaText})`));
  }

  if (result.status === "needs_review") {
    console.log(palette.danger(`  needs review after ${result.attempts} attempt(s):`));
    for (const e of result.errors) console.log(palette.danger(`    ${sym.bullet} ${e.rule}: ${e.detail}`));
  }
  for (const w of result.warnings) {
    console.log(palette.warn(`  ${sym.warn} ${w.rule}: ${w.detail}`));
  }

  if (result.status === "unchanged") {
    console.log(chalk.dim("  no change suggested"));
    return { choice: "skip" };
  }

  const choices = [
    { name: `${sym.tick} Accept`, value: "accept" as const },
    { name: `${sym.pointer} Edit`, value: "edit" as const },
    { name: `${sym.line} Skip`, value: "skip" as const },
    { name: `${sym.arrowRight} Accept all remaining clean suggestions`, value: "accept-all-clean" as const },
    { name: `${sym.cross} Quit and save progress`, value: "quit" as const },
  ];
  if (result.status === "needs_review") {
    choices.shift(); // remove plain "Accept" for anything that failed validation
  }

  const choice = await select({
    message: "Apply this rewrite?",
    choices,
    default: result.status === "ok" ? "accept" : "skip",
  });

  if (choice === "edit") {
    const edited = await input({ message: "Enter replacement text:", default: result.rewrite });
    const useIt = await confirm({ message: "Use this text?", default: true });
    if (useIt) return { choice: "edit", edited };
    return { choice: "skip" };
  }

  return { choice };
}

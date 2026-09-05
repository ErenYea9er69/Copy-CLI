import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { renderReviewDiff } from "./diff.js";
import { palette, sym, rule } from "./theme.js";
import type { RewriteResult } from "../extract/types.js";

export type ReviewChoice = "accept" | "edit" | "skip" | "accept-all-clean" | "quit";

const STATUS_BADGE: Record<RewriteResult["status"], string> = {
  ok: palette.success(`${sym.tick} clean`),
  needs_review: palette.danger(`${sym.cross} needs review`),
  unchanged: chalk.dim(`${sym.dash} unchanged`),
  failed: palette.warn(`${sym.warn} failed`),
};

export async function reviewOne(result: RewriteResult, index: number, total: number): Promise<{ choice: ReviewChoice; edited?: string }> {
  const { candidate } = result;
  console.log("");
  console.log(rule());

  // Progress counter + location on one line
  const counter = chalk.dim(`${index + 1}/${total}`);
  const location = chalk.dim(`${candidate.file}:${candidate.line}`);
  const roleTag = result.role ? palette.accent(`[${result.role}]`) : "";
  console.log(`  ${counter}  ${location}  ${roleTag}  ${STATUS_BADGE[result.status]}`);
  console.log("");

  // Diff
  console.log(renderReviewDiff(candidate.value, result.rewrite));

  // Rationale + score
  if (result.rationale) {
    console.log(chalk.dim(`  ${sym.info} ${result.rationale}`));
  }
  if (result.scoreBefore != null && result.scoreAfter != null) {
    const delta = result.scoreAfter - result.scoreBefore;
    const deltaText = delta > 0 ? palette.success(`+${delta}`) : delta < 0 ? palette.danger(`${delta}`) : chalk.dim("+0");
    console.log(chalk.dim(`  clarity: ${result.scoreBefore} ${sym.arrow} ${result.scoreAfter} (${deltaText})`));
  }

  // Validation issues
  if (result.status === "needs_review") {
    console.log(palette.danger(`  needs review after ${result.attempts} attempt(s):`));
    for (const e of result.errors) {
      console.log(palette.danger(`    ${sym.pointer} ${e.rule}: ${e.detail}`));
    }
  }
  for (const w of result.warnings) {
    console.log(palette.warn(`  ${sym.warn} ${w.rule}: ${w.detail}`));
  }

  if (result.status === "unchanged") {
    console.log(chalk.dim("  no change suggested"));
    return { choice: "skip" };
  }

  console.log("");

  const choices = [
    { name: `${sym.tick} Accept`, value: "accept" as const },
    { name: `${sym.pointer} Edit`, value: "edit" as const },
    { name: `${sym.dash} Skip`, value: "skip" as const },
    { name: `${sym.arrow} Accept all remaining clean`, value: "accept-all-clean" as const },
    { name: `${sym.cross} Quit and save`, value: "quit" as const },
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

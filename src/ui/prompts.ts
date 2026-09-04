import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { renderInlineDiff } from "./diff.js";
import type { RewriteResult } from "../extract/types.js";

export type ReviewChoice = "accept" | "edit" | "skip" | "accept-all-clean" | "quit";

export async function reviewOne(result: RewriteResult, index: number, total: number): Promise<{ choice: ReviewChoice; edited?: string }> {
  const { candidate } = result;
  console.log("");
  console.log(chalk.dim(`[${index + 1}/${total}] ${candidate.file}:${candidate.line} (${candidate.source}${candidate.contextName ? " " + candidate.contextName : ""})`));
  console.log(renderInlineDiff(candidate.value, result.rewrite));
  if (result.rationale) console.log(chalk.dim(`  ${result.rationale}`));

  if (result.status === "needs_review") {
    console.log(chalk.red(`  needs review after ${result.attempts} attempt(s):`));
    for (const e of result.errors) console.log(chalk.red(`    - ${e.rule}: ${e.detail}`));
  }
  for (const w of result.warnings) {
    console.log(chalk.yellow(`  warning: ${w.rule}: ${w.detail}`));
  }

  if (result.status === "unchanged") {
    console.log(chalk.dim("  no change suggested"));
    return { choice: "skip" };
  }

  const choices = [
    { name: "Accept", value: "accept" as const },
    { name: "Edit", value: "edit" as const },
    { name: "Skip", value: "skip" as const },
    { name: "Accept all remaining clean suggestions", value: "accept-all-clean" as const },
    { name: "Quit and save progress", value: "quit" as const },
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

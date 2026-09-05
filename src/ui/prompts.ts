import * as readline from "node:readline/promises";
import chalk from "chalk";
import type { RewriteResult } from "../extract/types.js";
import { palette, sym, progressBar, block } from "./theme.js";
import { renderReviewDiff } from "./diff.js";

function statusBadge(status: RewriteResult["status"]): string {
  switch (status) {
    case "ok":
      return palette.success.bold(`${sym.tick} Clean`);
    case "needs_review":
      return palette.warn.bold(`${sym.warn} Needs Review`);
    case "failed":
      return palette.danger.bold(`${sym.cross} Failed`);
    case "unchanged":
      return chalk.dim(`${sym.circle} Unchanged`);
  }
}

/**
 * Interactive step-by-step review prompt for proposed AI rewrites.
 */
export async function reviewInteractively(
  candidates: RewriteResult[]
): Promise<{ accepted: RewriteResult[]; skipped: RewriteResult[] }> {
  const toReview = candidates.filter(
    (r) => r.status !== "failed" && r.rewrite.trim() !== r.candidate.value.trim()
  );

  const accepted: RewriteResult[] = [];
  const skipped: RewriteResult[] = [];

  if (toReview.length === 0) {
    return { accepted, skipped };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let acceptAll = false;

  try {
    for (let i = 0; i < toReview.length; i++) {
      const item = toReview[i];

      if (acceptAll) {
        accepted.push(item);
        continue;
      }

      console.log("\n" + chalk.dim("─".repeat(60)));
      
      const stepInfo = `Review ${i + 1}/${toReview.length}`;
      const progress = progressBar(i + 1, toReview.length, 12);
      const badge = statusBadge(item.status);
      const roleText = item.role ? `Role: ${palette.accent(item.role)}` : "";

      console.log(`${palette.bold.white(stepInfo)}  ${progress}  ${badge}  ${roleText}`);
      console.log(chalk.dim(`Location: ${item.candidate.file}:${item.candidate.line}`));

      if (item.scoreBefore !== undefined && item.scoreAfter !== undefined) {
        const delta = item.scoreAfter - item.scoreBefore;
        const deltaStr = delta > 0 ? palette.success(`+${delta}`) : chalk.dim(String(delta));
        console.log(chalk.dim(`Clarity Score: ${item.scoreBefore} → ${item.scoreAfter} (${deltaStr})`));
      }

      console.log("\n" + renderReviewDiff(item.candidate.value, item.rewrite));

      if (item.rationale) {
        console.log(`\n  ${chalk.dim("Rationale:")} ${chalk.italic(item.rationale)}`);
      }

      if (item.warnings.length > 0) {
        const warnDetails = item.warnings.map((w) => w.detail).join(", ");
        console.log(`  ${palette.warn(sym.warn)} ${chalk.dim("Warning:")} ${warnDetails}`);
      }

      console.log("");
      const promptChoices = [
        `${palette.success.bold("[y]")} Accept`,
        `${palette.warn.bold("[n]")} Skip`,
        `${palette.info.bold("[a]")} Accept all remaining`,
        `${palette.danger.bold("[q]")} Quit`,
      ].join("  ");

      const answer = await rl.question(`${promptChoices} ${sym.user} `);
      const choice = answer.trim().toLowerCase();

      if (choice === "y" || choice === "") {
        accepted.push(item);
        console.log(`  ${palette.success(sym.tick)} Accepted`);
      } else if (choice === "a") {
        acceptAll = true;
        accepted.push(item);
        console.log(`  ${palette.info(sym.tick)} Accepted all remaining (${toReview.length - i} items)`);
      } else if (choice === "q") {
        console.log(chalk.dim("  Review aborted by user."));
        // Treat remaining as skipped
        for (let j = i; j < toReview.length; j++) {
          skipped.push(toReview[j]);
        }
        break;
      } else {
        skipped.push(item);
        console.log(`  ${chalk.dim(sym.dash)} Skipped`);
      }
    }
  } finally {
    rl.close();
  }

  return { accepted, skipped };
}

import chalk from "chalk";
import { relative } from "node:path";
import type { Config } from "../config/schema.js";
import type { CopyString } from "../extract/types.js";
import { rewriteAllWithRules } from "../rewrite/ruleEngine.js";

export interface LintReport {
  totalStrings: number;
  needsFix: number;
  violations: number;
  ok: boolean;
}

export function runLint(strings: CopyString[], config: Config, cwd: string): LintReport {
  const results = rewriteAllWithRules(strings, config);
  const needsFix = results.filter((r) => r.changed);
  const withViolations = results.filter((r) => r.violations.length > 0);

  if (needsFix.length === 0 && withViolations.length === 0) {
    console.log(chalk.green(`✓ ${strings.length} string(s) checked, no style guide issues found.`));
    return { totalStrings: strings.length, needsFix: 0, violations: 0, ok: true };
  }

  let lastFile = "";
  for (const result of [...needsFix, ...withViolations.filter((r) => !r.changed)]) {
    const relPath = relative(cwd, result.source.file);
    if (relPath !== lastFile) {
      console.log("\n" + chalk.underline(relPath));
      lastFile = relPath;
    }
    const tag = result.changed ? chalk.yellow("needs rewrite") : chalk.red("violation");
    console.log(`  L${result.source.line} [${tag}] "${result.source.text}"`);
    for (const reason of result.reasons) console.log(`    ${chalk.dim("fix:")} ${reason}`);
    for (const violation of result.violations) console.log(`    ${chalk.red("!")} ${violation}`);
  }

  console.log(
    "\n" +
      chalk.bold(
        `${needsFix.length} string(s) need a rewrite, ${withViolations.length} have unresolved violations.`
      )
  );
  console.log(chalk.dim("Run `copyshed apply` to fix what can be fixed automatically."));

  return {
    totalStrings: strings.length,
    needsFix: needsFix.length,
    violations: withViolations.length,
    ok: false
  };
}

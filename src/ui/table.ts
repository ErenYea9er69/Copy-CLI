import Table from "cli-table3";
import chalk from "chalk";
import type { StringCandidate, RuleViolation } from "../extract/types.js";

export function renderCandidateTable(candidates: StringCandidate[]): string {
  const table = new Table({
    head: ["file:line", "source", "value"].map((h) => chalk.bold(h)),
    wordWrap: true,
    colWidths: [34, 16, 60],
  });
  for (const c of candidates) {
    table.push([`${c.file}:${c.line}`, c.contextName ? `${c.source} (${c.contextName})` : c.source, c.value]);
  }
  return table.toString();
}

export function renderViolationTable(rows: { location: string; value: string; violations: RuleViolation[] }[]): string {
  const table = new Table({
    head: ["location", "value", "violation"].map((h) => chalk.bold(h)),
    wordWrap: true,
    colWidths: [30, 40, 40],
  });
  for (const row of rows) {
    const text = row.violations.map((v) => `${v.severity === "error" ? chalk.red(v.rule) : chalk.yellow(v.rule)}: ${v.detail}`).join("\n");
    table.push([row.location, row.value, text]);
  }
  return table.toString();
}

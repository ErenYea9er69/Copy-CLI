import Table from "cli-table3";
import chalk from "chalk";
import type { StringCandidate, RuleViolation } from "../extract/types.js";
import type { ClarityScore } from "../rules/score.js";

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

function gradeColor(grade: ClarityScore["grade"]): (s: string) => string {
  if (grade === "A" || grade === "B") return chalk.green;
  if (grade === "C") return chalk.yellow;
  return chalk.red;
}

export function renderAuditTable(
  rows: { location: string; role: string; value: string; score: ClarityScore }[]
): string {
  const table = new Table({
    head: ["location", "role", "value", "grade", "notes"].map((h) => chalk.bold(h)),
    wordWrap: true,
    colWidths: [26, 8, 40, 8, 34],
  });
  for (const row of rows) {
    const notes: string[] = [];
    if (row.score.bannedWordHits > 0) notes.push(`${row.score.bannedWordHits} banned word(s)`);
    if (row.score.hasEmDash) notes.push("em dash");
    if (row.score.passiveHits > 0) notes.push(`${row.score.passiveHits} passive`);
    if (row.score.vagueHits > 0) notes.push(`${row.score.vagueHits} vague quantifier(s)`);
    notes.push(`grade ${row.score.readingGrade}`);
    const color = gradeColor(row.score.grade);
    table.push([row.location, row.role, row.value, color(`${row.score.grade} (${row.score.score})`), notes.join(", ")]);
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

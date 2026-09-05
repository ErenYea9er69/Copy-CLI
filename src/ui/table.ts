import Table from "cli-table3";
import chalk from "chalk";
import type { StringCandidate, RuleViolation } from "../extract/types.js";
import type { ClarityScore } from "../rules/score.js";
import { palette } from "./theme.js";

/** Shared rounded-border chrome so every table in the CLI reads as one family. */
const CHARS = {
  top: "─",
  "top-mid": "┬",
  "top-left": "╭",
  "top-right": "╮",
  bottom: "─",
  "bottom-mid": "┴",
  "bottom-left": "╰",
  "bottom-right": "╯",
  left: "│",
  "left-mid": "├",
  mid: "─",
  "mid-mid": "┼",
  right: "│",
  "right-mid": "┤",
  middle: "│",
};

function baseTable(head: string[], colWidths: number[]) {
  return new Table({
    head: head.map((h) => palette.accent(chalk.bold(h.toUpperCase()))),
    wordWrap: true,
    colWidths,
    chars: CHARS,
    style: { head: [], border: [] },
  });
}

const SOURCE_LABEL: Record<string, string> = {
  "jsx-text": "jsx text",
  "jsx-attribute": "jsx attr",
  "call-argument": "call arg",
  "object-property": "object",
  "json-value": "json",
};

export function renderCandidateTable(candidates: StringCandidate[]): string {
  const table = baseTable(["file:line", "source", "value"], [34, 16, 60]);
  for (const c of candidates) {
    const src = SOURCE_LABEL[c.source] ?? c.source;
    const sourceCell = c.contextName ? `${src} ${chalk.dim(`(${c.contextName})`)}` : src;
    table.push([chalk.dim(`${c.file}:${c.line}`), sourceCell, c.value]);
  }
  return table.toString();
}

function gradeColor(grade: ClarityScore["grade"]): (s: string) => string {
  if (grade === "A" || grade === "B") return palette.success;
  if (grade === "C") return palette.warn;
  return palette.danger;
}

function gradeBadge(score: ClarityScore): string {
  const color = gradeColor(score.grade);
  return color(chalk.bold(` ${score.grade} `)) + chalk.dim(` ${score.score}`);
}

export function renderAuditTable(
  rows: { location: string; role: string; value: string; score: ClarityScore }[]
): string {
  const table = baseTable(["location", "role", "value", "grade", "notes"], [24, 10, 38, 10, 32]);
  for (const row of rows) {
    const notes: string[] = [];
    if (row.score.bannedWordHits > 0) notes.push(palette.danger(`${row.score.bannedWordHits} banned`));
    if (row.score.hasEmDash) notes.push(palette.warn("em dash"));
    if (row.score.passiveHits > 0) notes.push(`${row.score.passiveHits} passive`);
    if (row.score.vagueHits > 0) notes.push(`${row.score.vagueHits} vague`);
    notes.push(chalk.dim(`grade ${row.score.readingGrade}`));
    table.push([chalk.dim(row.location), chalk.dim(row.role), row.value, gradeBadge(row.score), notes.join(chalk.dim(", "))]);
  }
  return table.toString();
}

export function renderViolationTable(rows: { location: string; value: string; violations: RuleViolation[] }[]): string {
  const table = baseTable(["location", "value", "violation"], [30, 40, 40]);
  for (const row of rows) {
    const text = row.violations
      .map((v) => `${v.severity === "error" ? palette.danger(chalk.bold(v.rule)) : palette.warn(chalk.bold(v.rule))}${chalk.dim(":")} ${v.detail}`)
      .join("\n");
    table.push([chalk.dim(row.location), row.value, text]);
  }
  return table.toString();
}

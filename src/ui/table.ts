import chalk from "chalk";
import type { StringCandidate, RuleViolation } from "../extract/types.js";
import type { ClarityScore } from "../rules/score.js";
import { palette, sym, termWidth, fit } from "./theme.js";

// ---------------------------------------------------------------------------
// Fluid column renderer
// ---------------------------------------------------------------------------

interface Column {
  header: string;
  width: number; // as a fraction of available width (0-1)
  minWidth?: number;
}

function renderTable(columns: Column[], rows: string[][]): string {
  const tw = termWidth() - 2; // 2 chars margin
  const widths = columns.map((c) => Math.max(c.minWidth ?? 8, Math.floor(tw * c.width)));

  // Header
  const headerLine = columns
    .map((c, i) => chalk.dim.bold(fit(c.header.toUpperCase(), widths[i])))
    .join("  ");

  const separator = chalk.dim(sym.dash.repeat(tw));

  const bodyLines = rows.map((row) =>
    row.map((cell, i) => fit(cell, widths[i])).join("  ")
  );

  return [headerLine, separator, ...bodyLines].join("\n");
}

// ---------------------------------------------------------------------------
// Candidate table (scan command)
// ---------------------------------------------------------------------------

const SOURCE_LABEL: Record<string, string> = {
  "jsx-text": "jsx text",
  "jsx-attribute": "jsx attr",
  "call-argument": "call arg",
  "object-property": "object",
  "json-value": "json",
};

export function renderCandidateTable(candidates: StringCandidate[]): string {
  const columns: Column[] = [
    { header: "Location", width: 0.3, minWidth: 16 },
    { header: "Source", width: 0.14, minWidth: 8 },
    { header: "Value", width: 0.52, minWidth: 20 },
  ];

  const rows = candidates.map((c) => {
    const src = SOURCE_LABEL[c.source] ?? c.source;
    const sourceCell = c.contextName ? `${src} ${chalk.dim(`(${c.contextName})`)}` : src;
    return [chalk.dim(`${c.file}:${c.line}`), sourceCell, c.value];
  });

  return renderTable(columns, rows);
}

// ---------------------------------------------------------------------------
// Audit table
// ---------------------------------------------------------------------------

function gradeColor(grade: ClarityScore["grade"]): (s: string) => string {
  if (grade === "A" || grade === "B") return palette.success;
  if (grade === "C") return palette.warn;
  return palette.danger;
}

function gradeBadge(score: ClarityScore): string {
  const color = gradeColor(score.grade);
  return `${color(chalk.bold(score.grade))} ${chalk.dim(String(score.score))}`;
}

export function renderAuditTable(
  rows: { location: string; role: string; value: string; score: ClarityScore }[]
): string {
  const columns: Column[] = [
    { header: "Location", width: 0.22, minWidth: 14 },
    { header: "Role", width: 0.08, minWidth: 6 },
    { header: "Value", width: 0.34, minWidth: 16 },
    { header: "Grade", width: 0.1, minWidth: 6 },
    { header: "Notes", width: 0.22, minWidth: 12 },
  ];

  const tableRows = rows.map((row) => {
    const notes: string[] = [];
    if (row.score.bannedWordHits > 0) notes.push(palette.danger(`${row.score.bannedWordHits} banned`));
    if (row.score.hasEmDash) notes.push(palette.warn("em dash"));
    if (row.score.passiveHits > 0) notes.push(`${row.score.passiveHits} passive`);
    if (row.score.vagueHits > 0) notes.push(`${row.score.vagueHits} vague`);
    notes.push(chalk.dim(`grade ${row.score.readingGrade}`));
    return [
      chalk.dim(row.location),
      chalk.dim(row.role),
      row.value,
      gradeBadge(row.score),
      notes.join(chalk.dim(", ")),
    ];
  });

  return renderTable(columns, tableRows);
}

// ---------------------------------------------------------------------------
// Violation table (check command)
// ---------------------------------------------------------------------------

export function renderViolationTable(
  rows: { location: string; value: string; violations: RuleViolation[] }[]
): string {
  const columns: Column[] = [
    { header: "Location", width: 0.25, minWidth: 14 },
    { header: "Value", width: 0.35, minWidth: 16 },
    { header: "Violation", width: 0.36, minWidth: 16 },
  ];

  const tableRows = rows.map((row) => {
    const text = row.violations
      .map((v) => {
        const label = v.severity === "error" ? palette.danger(v.rule) : palette.warn(v.rule);
        return `${label} ${chalk.dim(v.detail)}`;
      })
      .join("; ");
    return [chalk.dim(row.location), row.value, text];
  });

  return renderTable(columns, tableRows);
}

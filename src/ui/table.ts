import chalk from "chalk";
import boxen from "boxen";
import type { StringCandidate, RuleViolation } from "../extract/types.js";
import type { ClarityScore } from "../rules/score.js";
import { palette, sym, termWidth, fit, isNoColor } from "./theme.js";

interface Column {
  header: string;
  width: number;
  minWidth?: number;
}

/**
 * Standard grid table for wide terminals (>= 85 columns).
 */
function renderGridTable(columns: Column[], rows: string[][]): string {
  const tw = termWidth() - 4; // Account for boxen border and padding
  const widths = columns.map((c) => Math.max(c.minWidth ?? 8, Math.floor(tw * c.width)));

  // Clear, non-dimmed headers with strong visual hierarchy
  const headerLine = columns
    .map((c, i) => palette.bold.white(fit(c.header.toUpperCase(), widths[i])))
    .join("  ");

  const divider = columns
    .map((_, i) => chalk.dim("─".repeat(widths[i])))
    .join("  ");

  const bodyLines = rows.map((row) =>
    row.map((cell, i) => fit(cell, widths[i])).join("  ")
  );

  const tableContent = [headerLine, divider, ...bodyLines].join("\n");

  return boxen(tableContent, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: isNoColor ? "white" : "gray",
  });
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
  const width = termWidth();

  // Narrow viewport reflow mode (< 85 columns)
  if (width < 85) {
    const cards = candidates.map((c) => {
      const src = SOURCE_LABEL[c.source] ?? c.source;
      const meta = c.contextName ? `${src} · ${c.contextName}` : src;
      const header = `${palette.accent(sym.pointer)} ${palette.bold.white(c.file)}:${chalk.dim(String(c.line))}  ${chalk.dim(`[${meta}]`)}`;
      const val = `  "${chalk.white(c.value)}"`;
      return `${header}\n${val}`;
    });
    return cards.join("\n\n");
  }

  // Grid mode (>= 85 columns)
  const columns: Column[] = [
    { header: "Location", width: 0.35, minWidth: 20 },
    { header: "Source", width: 0.18, minWidth: 12 },
    { header: "Value", width: 0.47, minWidth: 24 },
  ];

  const rows = candidates.map((c) => {
    const src = SOURCE_LABEL[c.source] ?? c.source;
    const sourceCell = c.contextName ? `${src} ${chalk.dim(`(${c.contextName})`)}` : src;
    return [palette.accent(`${c.file}:${c.line}`), chalk.dim(sourceCell), c.value];
  });

  return renderGridTable(columns, rows);
}

// ---------------------------------------------------------------------------
// Audit table (audit command)
// ---------------------------------------------------------------------------

function gradeColor(grade: ClarityScore["grade"]): (s: string) => string {
  if (grade === "A" || grade === "B") return palette.success;
  if (grade === "C") return palette.warn;
  return palette.danger;
}

function gradeBadge(score: ClarityScore): string {
  const color = gradeColor(score.grade);
  return `${color(chalk.bold(`Grade ${score.grade}`))} ${chalk.dim(`(${score.score})`)}`;
}

export function renderAuditTable(
  rows: { location: string; role: string; value: string; score: ClarityScore }[]
): string {
  const width = termWidth();

  // Narrow viewport reflow mode (< 85 columns)
  if (width < 85) {
    const cards = rows.map((row) => {
      const notes: string[] = [];
      if (row.score.bannedWordHits > 0) notes.push(palette.danger(`${row.score.bannedWordHits} banned`));
      if (row.score.hasEmDash) notes.push(palette.warn("em dash"));
      if (row.score.passiveHits > 0) notes.push(`${row.score.passiveHits} passive`);
      if (row.score.vagueHits > 0) notes.push(`${row.score.vagueHits} vague`);
      notes.push(chalk.dim(`reading grade ${row.score.readingGrade}`));

      const header = `${gradeBadge(row.score)}  ${palette.bold.white(row.location)} ${chalk.dim(`[${row.role}]`)}`;
      const val = `  "${chalk.white(row.value)}"`;
      const notesLine = `  ${chalk.dim("Notes:")} ${notes.join(chalk.dim(", "))}`;
      return `${header}\n${val}\n${notesLine}`;
    });
    return cards.join("\n\n");
  }

  // Grid mode (>= 85 columns)
  const columns: Column[] = [
    { header: "Location", width: 0.25, minWidth: 16 },
    { header: "Role", width: 0.10, minWidth: 8 },
    { header: "Value", width: 0.35, minWidth: 20 },
    { header: "Grade", width: 0.12, minWidth: 10 },
    { header: "Notes", width: 0.18, minWidth: 14 },
  ];

  const tableRows = rows.map((row) => {
    const notes: string[] = [];
    if (row.score.bannedWordHits > 0) notes.push(palette.danger(`${row.score.bannedWordHits} banned`));
    if (row.score.hasEmDash) notes.push(palette.warn("em dash"));
    if (row.score.passiveHits > 0) notes.push(`${row.score.passiveHits} passive`);
    if (row.score.vagueHits > 0) notes.push(`${row.score.vagueHits} vague`);
    notes.push(chalk.dim(`gr ${row.score.readingGrade}`));

    return [
      chalk.dim(row.location),
      palette.accent(row.role),
      row.value,
      gradeBadge(row.score),
      notes.join(chalk.dim(", ")),
    ];
  });

  return renderGridTable(columns, tableRows);
}

// ---------------------------------------------------------------------------
// Violation table (check command)
// ---------------------------------------------------------------------------

export function renderViolationTable(
  rows: { location: string; value: string; violations: RuleViolation[] }[]
): string {
  const width = termWidth();

  // Narrow viewport reflow mode (< 85 columns)
  if (width < 85) {
    const cards = rows.map((row) => {
      const header = `${palette.danger.bold(sym.cross)} ${palette.bold.white(row.location)}`;
      const val = `  "${chalk.white(row.value)}"`;
      const viols = row.violations.map((v) => {
        const tag = v.severity === "error" ? palette.danger(v.rule) : palette.warn(v.rule);
        return `  ${sym.bullet} ${tag}: ${chalk.dim(v.detail)}`;
      }).join("\n");
      return `${header}\n${val}\n${viols}`;
    });
    return cards.join("\n\n");
  }

  // Grid mode (>= 85 columns)
  const columns: Column[] = [
    { header: "Location", width: 0.26, minWidth: 16 },
    { header: "Value", width: 0.36, minWidth: 20 },
    { header: "Violations", width: 0.38, minWidth: 20 },
  ];

  const tableRows = rows.map((row) => {
    const text = row.violations
      .map((v) => {
        const label = v.severity === "error" ? palette.danger.bold(v.rule) : palette.warn(v.rule);
        return `${label} ${chalk.dim(v.detail)}`;
      })
      .join("; ");
    return [chalk.dim(row.location), row.value, text];
  });

  return renderGridTable(columns, tableRows);
}

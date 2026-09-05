import chalk from "chalk";
import figures from "figures";

/**
 * Design system for copyshed's terminal UI.
 *
 * Design language: "surgical minimalism" — inspired by Claude Code and
 * Gemini CLI. No ASCII art banners, no bordered boxes, no gradients.
 * Instead: bold/dim contrast, a single accent color, semantic symbols,
 * and breathing room through strategic blank lines.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const ACCENT = "#7C5CFF"; // violet — the one brand color

export const palette = {
  accent: chalk.hex(ACCENT),
  success: chalk.hex("#3DDC84"),
  warn: chalk.hex("#F5C451"),
  danger: chalk.hex("#F06464"),
  info: chalk.hex("#5FB0FF"),
  muted: chalk.dim,
  bold: chalk.bold,
  faint: chalk.dim,
};

// ---------------------------------------------------------------------------
// Symbols — semantic minimum
// ---------------------------------------------------------------------------

export const sym = {
  brand: "◆",
  dot: "●",
  arrow: "→",
  tick: figures.tick,
  cross: figures.cross,
  pointer: "▸",
  dash: "─",
  bar: "│",
  warn: figures.warning,
  info: "ℹ",
  bullet: "·",
};

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Returns terminal width, capped for readability. */
export function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

/** Thin horizontal rule. */
export function rule(): string {
  return chalk.dim(sym.dash.repeat(termWidth()));
}

/**
 * Compact command header — the first thing every command prints.
 * Example: `◆ copyshed rewrite  ·  12 strings  ·  3 files`
 */
export function header(command: string, ...segments: string[]): string {
  const brand = palette.accent(`${sym.brand} copyshed`);
  const cmd = chalk.bold.white(command);
  const meta = segments.length > 0
    ? `  ${chalk.dim(sym.bullet)}  ${segments.map((s) => chalk.dim(s)).join(`  ${chalk.dim(sym.bullet)}  `)}`
    : "";
  return `${brand} ${cmd}${meta}`;
}

/**
 * Compact banner for --help / bare invocation.
 * Just the brand mark + version + tagline on one line.
 */
export function banner(version: string): string {
  return `${palette.accent(`${sym.brand} copyshed`)} ${chalk.dim("v" + version)}  ${chalk.dim("—")}  ${chalk.dim("rewrite UI copy to match your brand voice")}`;
}

/**
 * Indented content block with a colored left bar, replacing boxen panels.
 * Each line is prefixed with a colored `│` for visual grouping.
 */
type BlockTone = "neutral" | "success" | "warn" | "danger" | "accent";

const TONE_FN: Record<BlockTone, (s: string) => string> = {
  neutral: chalk.dim,
  success: palette.success,
  warn: palette.warn,
  danger: palette.danger,
  accent: palette.accent,
};

export function block(title: string, lines: string[], tone: BlockTone = "neutral"): string {
  const colorFn = TONE_FN[tone];
  const bar = colorFn(sym.bar);
  const out: string[] = [];
  out.push(`${bar}  ${chalk.bold.white(title)}`);
  for (const line of lines) {
    out.push(`${bar}  ${line}`);
  }
  return out.join("\n");
}

/**
 * Bottom-of-command metadata line.
 * Example: `model: claude-sonnet-5  ·  2.3s  ·  12 strings processed`
 */
export function statusLine(...segments: string[]): string {
  return chalk.dim(segments.join(`  ${sym.bullet}  `));
}

/**
 * Compact inline progress bar for use inside spinner text.
 * Renders as `[████░░░░] 40%`
 */
export function progressBar(done: number, total: number, width = 16): string {
  if (total <= 0) return "";
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * width);
  const bar = palette.accent("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
  const pct = Math.round(ratio * 100);
  return `${bar} ${chalk.dim(`${pct}%`)}`;
}

/**
 * Pad a string to a given width, truncating with `…` if needed.
 */
export function fit(text: string, width: number): string {
  // Strip ANSI for length measurement
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (stripped.length <= width) {
    return text + " ".repeat(width - stripped.length);
  }
  // Need to truncate — rough approach: take characters until we hit width-1
  let visible = 0;
  let i = 0;
  const chars = [...text];
  while (i < chars.length && visible < width - 1) {
    if (chars[i] === "\x1b") {
      // Skip ANSI escape
      while (i < chars.length && chars[i] !== "m") i++;
      i++; // skip the 'm'
      continue;
    }
    visible++;
    i++;
  }
  return text.slice(0, i) + chalk.dim("…");
}

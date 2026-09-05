import chalk from "chalk";
import boxen, { type Options as BoxenOptions } from "boxen";
import figlet from "figlet";
import gradientString from "gradient-string";
import figures from "figures";

/**
 * Design system for Copyshed terminal UI.
 * Grounded in WCAG 2.2 AA contrast standards, NO_COLOR standard,
 * and responsive terminal constraints.
 */

// ---------------------------------------------------------------------------
// Environment & Accessibility Detection
// ---------------------------------------------------------------------------

export const isNoColor = Boolean(
  process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== ""
);

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BRAND_BLUE = "#3b82f6";
const BRAND_PURPLE = "#8b5cf6";
const BRAND_PINK = "#ec4899";

const rawGradient = gradientString(BRAND_BLUE, BRAND_PURPLE, BRAND_PINK);

export const brandGradient = Object.assign(
  (s: string) => (isNoColor ? s : rawGradient(s)),
  {
    multiline: (s: string) => (isNoColor ? s : rawGradient.multiline(s)),
  }
);


/**
 * Palette with high contrast on both dark and light terminal backgrounds.
 * Uses bright ANSI standards and vibrant accents.
 */
export const palette = {
  accent: isNoColor ? chalk.bold : chalk.hex("#60a5fa"),
  brand: isNoColor ? chalk.bold : chalk.hex(BRAND_PURPLE),
  success: isNoColor ? chalk.bold : chalk.hex("#22c55e"),
  warn: isNoColor ? chalk.bold : chalk.hex("#eab308"),
  danger: isNoColor ? chalk.bold : chalk.hex("#ef4444"),
  info: isNoColor ? chalk.bold : chalk.hex("#38bdf8"),
  muted: chalk.dim,
  bold: chalk.bold,
  faint: chalk.dim,
  inverse: chalk.inverse,
};

// ---------------------------------------------------------------------------
// Symbols & Prefixes (Distinct, Never Color-Alone)
// ---------------------------------------------------------------------------

export const sym = {
  user: chalk.bold("❯"),
  action: chalk.bold("◆"),
  task: chalk.hex(BRAND_PURPLE).bold("✦"),
  dash: "─",
  tick: figures.tick,
  cross: figures.cross,
  warn: figures.warning,
  info: figures.info,
  pointer: figures.pointer,
  bullet: figures.bullet,
  dot: "●",
  circle: "○",
  plus: "+",
  minus: "−",
  arrow: figures.arrowRight,
  ellipsis: "…",
};

// ---------------------------------------------------------------------------
// Layout helpers & Responsiveness
// ---------------------------------------------------------------------------

export function termWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.max(40, Math.min(cols, 120));
}

export function rule(): string {
  return chalk.dim(sym.dash.repeat(termWidth()));
}

/**
 * Strip ANSI codes to measure true visible column width.
 */
export function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/**
 * Fit string to a given visible width with padding or truncation.
 * Preserves ANSI closure so colors never leak into adjacent cells.
 */
export function fit(text: string, width: number): string {
  const len = visibleLength(text);
  if (len === width) return text;
  if (len < width) {
    return text + " ".repeat(width - len);
  }

  // Truncate safely with ellipsis
  let visible = 0;
  let i = 0;
  const chars = [...text];
  const target = Math.max(1, width - 1);

  while (i < chars.length && visible < target) {
    if (chars[i] === "\x1b") {
      while (i < chars.length && chars[i] !== "m") i++;
      i++;
      continue;
    }
    visible++;
    i++;
  }

  return text.slice(0, i) + "\x1b[0m" + chalk.dim(sym.ellipsis);
}

// ---------------------------------------------------------------------------
// Responsive Banner
// ---------------------------------------------------------------------------

let cachedBanner: string | null = null;

export function banner(version: string, width = termWidth()): string {
  if (cachedBanner && width >= 80) return cachedBanner;

  // Narrow terminal view (< 80 columns)
  if (width < 80) {
    const title = brandGradient(` COPYSHED v${version} `);
    const subtitle = chalk.dim("UI Copy & House Style Engine");
    const hint = chalk.dim("Type /help for commands or ask a question.");
    const content = `${title}\n${subtitle}\n\n${hint}`;
    return boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: isNoColor ? "white" : "#8b5cf6",
    });
  }

  // Standard/Wide terminal view (>= 80 columns)
  const art = figlet.textSync("COPYSHED", { font: "Standard" });
  const painted = brandGradient.multiline(art);
  const tag = `  ${palette.bold.white("UI Copy & House Style Engine")}  ${chalk.dim(`v${version}`)}`;
  const tips = chalk.dim(
    "  • /scan     Find user-facing strings in code\n" +
    "  • /audit    Score copy for clarity & psychology\n" +
    "  • /rewrite  Generate smart brand improvements\n" +
    "  • /apply    Review and apply suggestions\n" +
    "  • /help     View all commands & options"
  );

  const full = `${painted}\n${tag}\n\n${tips}`;
  cachedBanner = full;
  return full;
}

/**
 * Command header line
 */
export function header(command: string, ...segments: string[]): string {
  const meta = segments.length > 0 ? `  ${chalk.dim(segments.join("  "))}` : "";
  return `${sym.user} ${chalk.dim("Running:")} ${palette.bold.white(command)}${meta}`;
}

const BOX_BASE: BoxenOptions = {
  padding: { top: 0, bottom: 0, left: 1, right: 1 },
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  borderStyle: "round",
};

export type BlockTone = "neutral" | "success" | "warn" | "danger" | "accent";

const TONE_COLOR: Record<BlockTone, string> = {
  neutral: isNoColor ? "white" : "gray",
  success: isNoColor ? "white" : "#22c55e",
  warn: isNoColor ? "white" : "#eab308",
  danger: isNoColor ? "white" : "#ef4444",
  accent: isNoColor ? "white" : BRAND_PURPLE,
};

/**
 * Renders a rounded boxen panel with high-contrast borders and clear typography.
 */
export function block(title: string, lines: string[], tone: BlockTone = "neutral"): string {
  const body = [palette.bold.white(title), "", ...lines].join("\n");
  return boxen(body, {
    ...BOX_BASE,
    borderColor: TONE_COLOR[tone],
  });
}

/**
 * Bottom-of-command metadata line.
 */
export function statusLine(...segments: string[]): string {
  const width = termWidth();
  const valid = segments.filter(Boolean);
  if (valid.length === 0) return "";

  const segWidth = Math.floor(width / valid.length);
  const padded = valid.map((s, i) => {
    const rawLen = visibleLength(s);
    if (i === 0) return s + " ".repeat(Math.max(0, segWidth - rawLen));
    if (i === valid.length - 1) return " ".repeat(Math.max(0, segWidth - rawLen)) + s;
    return s + " ".repeat(Math.max(0, segWidth - rawLen));
  });

  return chalk.dim(padded.join(""));
}

/**
 * Visual progress bar with percentage.
 */
export function progressBar(done: number, total: number, width = 16): string {
  if (total <= 0) return "";
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * width);
  const bar = palette.accent("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
  const pct = Math.round(ratio * 100);
  return `${bar} ${palette.bold(`${pct}%`)}`;
}

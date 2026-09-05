import chalk from "chalk";
import boxen, { type Options as BoxenOptions } from "boxen";
import figlet from "figlet";
import gradientString from "gradient-string";
import figures from "figures";

/**
 * Single source of truth for how copyshed looks in a terminal. Every other
 * UI module (logger, table, diff, prompts) pulls its colors and symbols
 * from here so the whole CLI reads as one coherent product instead of a
 * pile of ad-hoc console.log calls.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BRAND_FROM = "#7C5CFF"; // violet
const BRAND_TO = "#22D3EE"; // cyan

export const palette = {
  brandFrom: BRAND_FROM,
  brandTo: BRAND_TO,
  accent: chalk.hex(BRAND_FROM),
  accent2: chalk.hex(BRAND_TO),
  success: chalk.hex("#3DDC84"),
  warn: chalk.hex("#F5C451"),
  danger: chalk.hex("#F06464"),
  info: chalk.hex("#5FB0FF"),
  muted: chalk.gray,
  bold: chalk.bold,
  faint: chalk.dim,
};

export const brandGradient = gradientString(BRAND_FROM, BRAND_TO);

// ---------------------------------------------------------------------------
// Symbols (figures handles the unicode -> ascii fallback on limited terminals)
// ---------------------------------------------------------------------------

export const sym = {
  tick: figures.tick,
  cross: figures.cross,
  warn: figures.warning,
  info: figures.info,
  pointer: figures.pointer,
  bullet: figures.bullet,
  arrowRight: figures.arrowRight,
  line: figures.line,
  ellipsis: figures.ellipsis,
  circle: figures.circle,
  squareSmallFilled: figures.squareSmallFilled,
};

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Full-width horizontal rule, sized to the current terminal (capped for readability). */
export function rule(char: string = figures.line): string {
  const width = Math.min(process.stdout.columns || 80, 96);
  return chalk.dim(char.repeat(width));
}

/** Section header used at the top of a command's output. */
export function sectionTitle(title: string, subtitle?: string): string {
  const head = `${palette.accent(figures.pointer)} ${chalk.bold.white(title)}`;
  return subtitle ? `${head} ${chalk.dim(subtitle)}` : head;
}

/** Small colored status badge, e.g. badge("ok", palette.success) -> " OK ". */
export function badge(text: string, color: (s: string) => string): string {
  return color.name ? color(chalk.bold(` ${text} `)) : chalk.bold(` ${text} `);
}

const BOX_BASE: BoxenOptions = {
  padding: { top: 0, bottom: 0, left: 1, right: 1 },
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
};

export function box(content: string, opts: BoxenOptions = {}): string {
  return boxen(content, { ...BOX_BASE, ...opts });
}

type PanelTone = "neutral" | "success" | "warn" | "danger" | "accent";

const TONE_COLOR: Record<PanelTone, string> = {
  neutral: "gray",
  success: "#3DDC84",
  warn: "#F5C451",
  danger: "#F06464",
  accent: BRAND_FROM,
};

/** Boxed summary panel, used for end-of-command results and confirmations. */
export function panel(title: string, lines: string[], tone: PanelTone = "neutral"): string {
  const body = [chalk.bold(title), "", ...lines].join("\n");
  return box(body, {
    borderColor: TONE_COLOR[tone],
    borderStyle: "round",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
  });
}

/** Renders a compact `[####------] 40%` progress bar for spinner text. */
export function progressBar(done: number, total: number, width = 20): string {
  if (total <= 0) return "";
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const pct = Math.round(ratio * 100);
  return `${palette.accent(bar)} ${chalk.dim(`${pct}%`)}`;
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

let cachedBanner: string | null = null;

/** Large gradient wordmark shown on bare invocation / --help, cached after first render. */
export function banner(version: string): string {
  if (cachedBanner) return cachedBanner;
  const wide = (process.stdout.columns || 80) >= 66;
  const art = figlet.textSync(wide ? "copyshed" : "copyshed", {
    font: wide ? "Standard" : "Small",
  });
  const painted = brandGradient.multiline(art);
  const tagline = chalk.dim("rewrite your UI copy to match your brand voice, right from the terminal");
  cachedBanner = [painted, `${chalk.dim("v" + version)}   ${tagline}`].join("\n");
  return cachedBanner;
}

/** Compact one-line banner for use inside non-interactive/CI output. */
export function compactBanner(version: string): string {
  return `${brandGradient("copyshed")} ${chalk.dim("v" + version)}`;
}

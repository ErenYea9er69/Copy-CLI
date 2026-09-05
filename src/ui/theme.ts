import chalk from "chalk";
import boxen, { type Options as BoxenOptions } from "boxen";
import figlet from "figlet";
import gradientString from "gradient-string";
import figures from "figures";

/**
 * Design system for copyshed's terminal UI, inspired by the Gemini CLI aesthetic.
 *
 * Design language: "Bold & Vibrant" — large ASCII banners, blue/purple/pink gradients,
 * rounded bordered boxes for distinct visual components, and explicit prefix prompts
 * (> for user, + for actions, ! for background tasks).
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const BRAND_BLUE = "#3b82f6";
const BRAND_PURPLE = "#a855f7";
const BRAND_PINK = "#ec4899";

export const palette = {
  accent: chalk.hex(BRAND_BLUE),
  success: chalk.hex("#3DDC84"),
  warn: chalk.hex("#F5C451"),
  danger: chalk.hex("#F06464"),
  info: chalk.hex("#5FB0FF"),
  muted: chalk.dim,
  bold: chalk.bold,
  faint: chalk.dim,
};

export const brandGradient = gradientString(BRAND_BLUE, BRAND_PURPLE, BRAND_PINK);

// ---------------------------------------------------------------------------
// Symbols & Prefixes
// ---------------------------------------------------------------------------

export const sym = {
  user: chalk.bold(">"),
  action: chalk.bold("+"),
  task: chalk.hex(BRAND_PURPLE).bold("!"),
  dash: "─",
  tick: figures.tick,
  cross: figures.cross,
  pointer: "▸",
  bullet: "·",
  dot: "●",
  warn: figures.warning,
  info: "ℹ",
  arrow: "→",
};

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

export function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

export function rule(): string {
  return chalk.dim(sym.dash.repeat(termWidth()));
}

let cachedBanner: string | null = null;

/**
 * Large gradient banner for CLI startup.
 */
export function banner(version: string): string {
  if (cachedBanner) return cachedBanner;
  // Using 'Slant' or default standard for a blocky look
  const art = figlet.textSync("> COPYSHED", { font: "Standard" });
  const painted = brandGradient.multiline(art);
  const info = chalk.dim(`Tips for getting started:\n1. Run 'copyshed init' to configure your project.\n2. Use 'copyshed rewrite' to improve your UI copy.\n3. Type 'copyshed --help' for more options.\n\nv${version}`);
  cachedBanner = [painted, info].join("\n\n");
  return cachedBanner;
}

/**
 * Prefix a command or user action like a prompt.
 */
export function header(command: string, ...segments: string[]): string {
  const meta = segments.length > 0 ? `  ${chalk.dim(segments.join("  "))}` : "";
  return `${sym.user} ${chalk.dim("Running:")} ${chalk.bold.white(command)}${meta}`;
}

const BOX_BASE: BoxenOptions = {
  padding: { top: 0, bottom: 0, left: 1, right: 1 },
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  borderStyle: "round",
};

type BlockTone = "neutral" | "success" | "warn" | "danger" | "accent";

const TONE_COLOR: Record<BlockTone, string> = {
  neutral: "gray",
  success: "#3DDC84",
  warn: "#F5C451",
  danger: "#F06464",
  accent: BRAND_PURPLE,
};

/**
 * Renders a rounded boxen panel.
 */
export function block(title: string, lines: string[], tone: BlockTone = "neutral"): string {
  const body = [chalk.bold(title), "", ...lines].join("\n");
  return boxen(body, {
    ...BOX_BASE,
    borderColor: TONE_COLOR[tone],
  });
}

/**
 * Full-width, multi-segment status bar at the bottom.
 */
export function statusLine(...segments: string[]): string {
  const width = termWidth();
  // Divide available width evenly among segments
  const segWidth = Math.floor(width / Math.max(1, segments.length));
  
  const padded = segments.map((s, i) => {
    const strippedLength = s.replace(/\x1b\[[0-9;]*m/g, "").length;
    if (i === 0) return s.padEnd(segWidth + (s.length - strippedLength));
    if (i === segments.length - 1) return s.padStart(segWidth + (s.length - strippedLength));
    return s.padEnd(segWidth + (s.length - strippedLength));
  });
  
  return chalk.dim(padded.join(""));
}

export function fit(text: string, width: number): string {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (stripped.length <= width) {
    return text + " ".repeat(width - stripped.length);
  }
  let visible = 0;
  let i = 0;
  const chars = [...text];
  while (i < chars.length && visible < width - 1) {
    if (chars[i] === "\x1b") {
      while (i < chars.length && chars[i] !== "m") i++;
      i++;
      continue;
    }
    visible++;
    i++;
  }
  return text.slice(0, i) + chalk.dim("…");
}

export function progressBar(done: number, total: number, width = 16): string {
  if (total <= 0) return "";
  const ratio = Math.max(0, Math.min(1, done / total));
  const filled = Math.round(ratio * width);
  const bar = palette.accent("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
  const pct = Math.round(ratio * 100);
  return `${bar} ${chalk.dim(`${pct}%`)}`;
}

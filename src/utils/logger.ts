import chalk from "chalk";
import { palette, sym, header, rule, block, statusLine } from "../ui/theme.js";

export const log = {
  info: (msg: string) => console.log(`${palette.info(sym.info)} ${msg}`),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  ok: (msg: string) => console.log(`${palette.success(sym.tick)} ${msg}`),
  warn: (msg: string) => console.log(`${palette.warn(sym.warn)} ${msg}`),
  error: (msg: string) => console.error(`${palette.danger(sym.cross)} ${msg}`),
  step: (msg: string) => console.log(`${palette.accent(sym.pointer)} ${msg}`),

  /** Bold section heading kept for backward compatibility with plain output. */
  heading: (msg: string) => console.log(chalk.bold.white(msg)),

  /** Compact command header: `◆ copyshed <command>  ·  context segments` */
  header: (command: string, ...segments: string[]) => console.log(header(command, ...segments)),

  rule: () => console.log(rule()),
  blank: () => console.log(""),

  /** Indented content block with colored left bar (replaces boxen panels). */
  block: (title: string, lines: string[], tone: "neutral" | "success" | "warn" | "danger" | "accent" = "neutral") =>
    console.log(block(title, lines, tone)),

  /** Bottom-of-command metadata line — model, timing, counts. */
  status: (...segments: string[]) => console.log(statusLine(...segments)),

  // Legacy alias: `log.panel()` maps to `log.block()` for compatibility
  panel: (title: string, lines: string[], tone: "neutral" | "success" | "warn" | "danger" | "accent" = "neutral") =>
    console.log(block(title, lines, tone)),

  // Legacy alias for `log.header()`
  title: (title: string, subtitle?: string) => {
    const segments = subtitle ? [subtitle] : [];
    console.log(header(title, ...segments));
  },
};

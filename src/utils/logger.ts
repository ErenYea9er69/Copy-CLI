import chalk from "chalk";
import { palette, sym, header, rule, block, statusLine } from "../ui/theme.js";

export const log = {
  info: (msg: string) => console.log(`${sym.action} ${msg}`),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  ok: (msg: string) => console.log(`${palette.success(sym.tick)} ${msg}`),
  warn: (msg: string) => console.log(`${palette.warn(sym.warn)} ${msg}`),
  error: (msg: string) => console.error(`${palette.danger(sym.cross)} ${msg}`),
  step: (msg: string) => console.log(`${sym.action} ${msg}`),

  heading: (msg: string) => console.log(chalk.bold.white(msg)),

  /** Compact command header: `> Running: command  segments` */
  header: (command: string, ...segments: string[]) => console.log(header(command, ...segments)),

  rule: () => console.log(rule()),
  blank: () => console.log(""),

  /** Rounded box panel. */
  block: (title: string, lines: string[], tone: "neutral" | "success" | "warn" | "danger" | "accent" = "neutral") =>
    console.log(block(title, lines, tone)),

  /** Bottom-of-command metadata line. */
  status: (...segments: string[]) => console.log(statusLine(...segments)),

  // Legacy aliases
  panel: (title: string, lines: string[], tone: "neutral" | "success" | "warn" | "danger" | "accent" = "neutral") =>
    console.log(block(title, lines, tone)),

  title: (title: string, subtitle?: string) => {
    const segments = subtitle ? [subtitle] : [];
    console.log(header(title, ...segments));
  },
};

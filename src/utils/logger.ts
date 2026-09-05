import chalk from "chalk";
import { palette, sym, sectionTitle, rule, panel } from "../ui/theme.js";

export const log = {
  info: (msg: string) => console.log(`${palette.info(sym.info)} ${msg}`),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  ok: (msg: string) => console.log(`${palette.success(sym.tick)} ${msg}`),
  warn: (msg: string) => console.log(`${palette.warn(sym.warn)} ${msg}`),
  error: (msg: string) => console.error(`${palette.danger(sym.cross)} ${msg}`),
  step: (msg: string) => console.log(`${palette.accent(sym.pointer)} ${msg}`),

  /** Bold section heading kept for backward compatibility with plain output. */
  heading: (msg: string) => console.log(chalk.bold.white(msg)),

  /** Preferred section heading: colored marker + title + optional dim subtitle. */
  title: (title: string, subtitle?: string) => console.log(sectionTitle(title, subtitle)),

  rule: () => console.log(rule()),

  blank: () => console.log(""),

  /** Boxed, color-coded summary panel for end-of-command results. */
  panel: (title: string, lines: string[], tone: "neutral" | "success" | "warn" | "danger" | "accent" = "neutral") =>
    console.log(panel(title, lines, tone)),
};

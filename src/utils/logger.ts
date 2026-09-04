import chalk from "chalk";

export const log = {
  info: (msg: string) => console.log(msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  ok: (msg: string) => console.log(chalk.green(msg)),
  warn: (msg: string) => console.log(chalk.yellow(msg)),
  error: (msg: string) => console.error(chalk.red(msg)),
  heading: (msg: string) => console.log(chalk.bold(msg)),
};

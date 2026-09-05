import ora, { type Ora } from "ora";
import { palette, progressBar, sym } from "./theme.js";

/**
 * Create a pre-styled spinner using the brand accent color.
 */
export function createSpinner(text: string): Ora {
  return ora({ text, spinner: "dots", color: "magenta" });
}

/**
 * Run a spinner for the duration of an async operation.
 * Automatically prints elapsed time on success.
 */
export async function withSpinner<T>(label: string, fn: (spinner: Ora) => Promise<T>): Promise<{ result: T; elapsed: number }> {
  const spinner = createSpinner(label);
  spinner.start();
  const start = Date.now();
  try {
    const result = await fn(spinner);
    const elapsed = (Date.now() - start) / 1000;
    spinner.succeed(`${label}  ${palette.muted(`${elapsed.toFixed(1)}s`)}`);
    return { result, elapsed };
  } catch (err) {
    const elapsed = (Date.now() - start) / 1000;
    spinner.fail(`${label}  ${palette.muted(`${elapsed.toFixed(1)}s`)}`);
    throw err;
  }
}

/**
 * Format spinner text with an integrated progress bar.
 * Used as a callback to update spinner.text during batch operations.
 */
export function spinnerProgress(done: number, total: number, detail: string, startedAt: number): string {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  return `${progressBar(done, total, 14)}  ${palette.muted(`${done}/${total}`)}  ${palette.muted(detail)}  ${palette.muted(`${elapsed}s`)}`;
}

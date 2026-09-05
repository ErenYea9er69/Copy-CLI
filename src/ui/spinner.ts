import ora, { type Ora } from "ora";
import { palette, sym } from "./theme.js";

export function createSpinner(text: string): Ora {
  // Gemini CLI style: ! Prefix
  return ora({ 
    text: `${sym.task} ${text}`, 
    spinner: "dots", 
    color: "magenta" 
  });
}

export async function withSpinner<T>(label: string, fn: (spinner: Ora) => Promise<T>): Promise<{ result: T; elapsed: number }> {
  const spinner = createSpinner(label);
  spinner.start();
  const start = Date.now();
  
  // Timer interval to update the text with seconds elapsed, like Gemini CLI
  const timerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    spinner.text = `${sym.task} ${label} ${palette.faint(`(${elapsed}s)`)}`;
  }, 1000);

  try {
    const result = await fn(spinner);
    clearInterval(timerId);
    const elapsed = (Date.now() - start) / 1000;
    spinner.succeed(`${sym.task} ${label} ${palette.muted(`(${elapsed.toFixed(1)}s)`)}`);
    return { result, elapsed };
  } catch (err) {
    clearInterval(timerId);
    const elapsed = (Date.now() - start) / 1000;
    spinner.fail(`${sym.cross} ${label} ${palette.muted(`(${elapsed.toFixed(1)}s)`)}`);
    throw err;
  }
}

export function spinnerProgress(done: number, total: number, detail: string, startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `${sym.task} Processing strings: ${done}/${total} (${pct}%) ${palette.faint(`(${elapsed}s)`)}`;
}

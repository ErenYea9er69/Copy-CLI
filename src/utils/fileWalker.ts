import fg from "fast-glob";
import type { Config } from "../config/schema.js";

export async function walkFiles(cwd: string, config: Config): Promise<string[]> {
  const files = await fg(config.include, {
    cwd,
    ignore: config.exclude,
    absolute: true,
    onlyFiles: true,
    dot: false
  });
  return files.sort();
}

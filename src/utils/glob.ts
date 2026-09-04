import fg from "fast-glob";
import type { Config } from "../config.js";

export async function resolveFiles(patterns: string[] | undefined, config: Config): Promise<string[]> {
  const include = patterns && patterns.length > 0 ? patterns : config.include;
  const files = await fg(include, {
    ignore: config.exclude,
    absolute: false,
    onlyFiles: true,
    dot: false,
  });
  return files.sort();
}

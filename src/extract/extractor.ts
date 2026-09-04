import { promises as fs } from "node:fs";
import path from "node:path";
import { extractFromSource } from "./jsExtractor.js";
import { extractFromJson } from "./jsonExtractor.js";
import type { StringCandidate } from "./types.js";
import type { Config } from "../config.js";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

export async function extractFile(filePath: string, config: Config): Promise<StringCandidate[]> {
  const ext = path.extname(filePath);
  const source = await fs.readFile(filePath, "utf8");

  if (JS_EXTENSIONS.has(ext)) {
    return extractFromSource(source, filePath, config);
  }
  if (ext === ".json") {
    return extractFromJson(source, filePath);
  }
  return [];
}

export async function extractFiles(filePaths: string[], config: Config): Promise<StringCandidate[]> {
  const all: StringCandidate[] = [];
  for (const file of filePaths) {
    try {
      const found = await extractFile(file, config);
      all.push(...found);
    } catch (err: any) {
      // A single unreadable/unparsable file should not abort the whole scan.
      process.stderr.write(`copyshed: skipped ${file} (${err.message})\n`);
    }
  }
  return all;
}

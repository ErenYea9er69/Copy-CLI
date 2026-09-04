import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { Config } from "../config/schema.js";
import { extractFromSource } from "./jsxExtractor.js";
import { extractFromJson } from "./jsonExtractor.js";
import type { ExtractionResult } from "./types.js";

const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

export function extractFile(file: string, config: Config): ExtractionResult {
  const source = readFileSync(file, "utf-8");
  const ext = extname(file);

  if (ext === ".json") {
    return extractFromJson(file, source);
  }
  if (JS_EXTENSIONS.has(ext)) {
    return extractFromSource(file, source, config);
  }
  return { file, originalContent: source, strings: [] };
}

export function extractFiles(files: string[], config: Config): ExtractionResult[] {
  return files.map((f) => extractFile(f, config));
}

export type { CopyString, ExtractionResult, SourceKind } from "./types.js";

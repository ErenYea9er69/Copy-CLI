import { promises as fs } from "node:fs";
import MagicString from "magic-string";
import type { RewriteResult } from "../extract/types.js";

function jsonEscape(value: string, filePath: string): string {
  // JSON locale files need a JSON-escaped replacement; JS/TS/JSX source
  // files need a JS-string-escaped replacement. Both happen to match
  // JSON.stringify's escaping rules for the characters that matter here.
  return JSON.stringify(value).slice(1, -1);
}

export interface ApplySummary {
  file: string;
  changed: number;
}

/**
 * Writes accepted rewrites to disk. Groups by file so every accepted
 * change in a file lands in a single write. Offsets come from the
 * original parse, and MagicString resolves overlapping overwrite() calls
 * against the original string regardless of call order, so this is safe
 * even when a file has several accepted candidates.
 */
export async function applyResults(results: RewriteResult[]): Promise<ApplySummary[]> {
  const byFile = new Map<string, RewriteResult[]>();
  for (const r of results) {
    const list = byFile.get(r.candidate.file) ?? [];
    list.push(r);
    byFile.set(r.candidate.file, list);
  }

  const summaries: ApplySummary[] = [];

  for (const [file, fileResults] of byFile) {
    const original = await fs.readFile(file, "utf8");
    const ms = new MagicString(original);
    let changed = 0;

    for (const r of fileResults) {
      if (r.rewrite === r.candidate.value) continue;
      const escaped = jsonEscape(r.rewrite, file);
      ms.overwrite(r.candidate.start, r.candidate.end, escaped);
      changed += 1;
    }

    if (changed > 0) {
      await fs.writeFile(file, ms.toString(), "utf8");
    }
    summaries.push({ file, changed });
  }

  return summaries;
}

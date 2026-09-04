import { writeFileSync, readFileSync } from "node:fs";
import MagicString from "magic-string";
import type { RewriteResult } from "../rewrite/types.js";
import { encodeLiteralBody } from "../extract/literalEncoding.js";

export interface ApplySummary {
  filesChanged: number;
  stringsChanged: number;
}

export function applyChanges(results: RewriteResult[]): ApplySummary {
  const changed = results.filter((r) => r.changed);
  const byFile = new Map<string, RewriteResult[]>();
  for (const result of changed) {
    const list = byFile.get(result.source.file) ?? [];
    list.push(result);
    byFile.set(result.source.file, list);
  }

  let stringsChanged = 0;

  for (const [file, fileResults] of byFile) {
    const original = readFileSync(file, "utf-8");
    const ms = new MagicString(original);

    // Sort by start offset so overlapping/adjacent edits behave predictably.
    const sorted = [...fileResults].sort((a, b) => a.source.start - b.source.start);

    for (const result of sorted) {
      const { start, end, quote } = result.source;
      const replacement = quote ? encodeLiteralBody(result.rewritten, quote) : result.rewritten;
      ms.overwrite(start, end, replacement);
      stringsChanged++;
    }

    writeFileSync(file, ms.toString(), "utf-8");
  }

  return { filesChanged: byFile.size, stringsChanged };
}

import { nanoid } from "nanoid";
import type { StringCandidate } from "./types.js";

/**
 * JSON has no AST offsets from JSON.parse, so this walks the raw text with
 * a small scanner to recover the exact start/end of each leaf string value.
 * That is what lets the patcher rewrite one value in place without
 * reformatting the rest of the file.
 */
export function extractFromJson(source: string, filePath: string): StringCandidate[] {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null) return [];

  const candidates: StringCandidate[] = [];
  const cursor = { pos: 0 };

  function findNextString(fromValue: string): { start: number; end: number } | null {
    // Search forward from the current cursor for a JSON string literal whose
    // decoded value equals fromValue. Skips over keys by requiring the match
    // sits after a colon at this scan position, which is good enough for the
    // flat/nested locale-file shape this extractor targets.
    const encoded = JSON.stringify(fromValue);
    const idx = source.indexOf(encoded, cursor.pos);
    if (idx === -1) return null;
    cursor.pos = idx + encoded.length;
    return { start: idx + 1, end: idx + encoded.length - 1 };
  }

  function walk(node: unknown, keyPath: string[]) {
    if (typeof node === "string") {
      const found = findNextString(node);
      if (!found) return;
      const before = source.slice(0, found.start);
      const line = before.split("\n").length;
      const column = found.start - before.lastIndexOf("\n");
      const trimmed = node.trim();
      if (trimmed.length < 2) return;
      candidates.push({
        id: nanoid(10),
        file: filePath,
        start: found.start,
        end: found.end,
        line,
        column,
        value: node,
        source: "json-value",
        contextName: keyPath.join("."),
        contextSnippet: keyPath.join(".") + ": " + JSON.stringify(node).slice(0, 160),
      });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...keyPath, String(i)]));
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [k, v] of Object.entries(node)) walk(v, [...keyPath, k]);
    }
  }

  walk(data, []);
  return candidates;
}

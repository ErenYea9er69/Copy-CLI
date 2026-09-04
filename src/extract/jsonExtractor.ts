import type { CopyString, ExtractionResult } from "./types.js";

/**
 * JSON.parse gives us values but throws away source positions, and we need
 * exact byte offsets to splice a rewrite back into the file safely. This is
 * a small hand-rolled scanner: it walks the same grammar JSON.parse does,
 * but records the start/end of every string it reads along the way.
 */
class JsonScanner {
  private i = 0;
  constructor(private src: string) {}

  private error(msg: string): never {
    throw new Error(`Invalid JSON at offset ${this.i}: ${msg}`);
  }

  private skipWs() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i]!)) this.i++;
  }

  private peek(): string {
    return this.src[this.i]!;
  }

  parseValue(path: string, onString: (start: number, end: number, value: string, path: string) => void): void {
    this.skipWs();
    const ch = this.peek();
    if (ch === "{") return this.parseObject(path, onString);
    if (ch === "[") return this.parseArray(path, onString);
    if (ch === '"') {
      const { start, end, value } = this.parseString();
      onString(start, end, value, path);
      return;
    }
    // number, boolean, null - skip over the token, we don't rewrite these.
    while (this.i < this.src.length && !/[,\]}\s]/.test(this.src[this.i]!)) this.i++;
  }

  private parseObject(path: string, onString: (s: number, e: number, v: string, p: string) => void) {
    this.i++; // {
    this.skipWs();
    if (this.peek() === "}") {
      this.i++;
      return;
    }
    while (true) {
      this.skipWs();
      if (this.peek() !== '"') this.error("expected string key");
      const { value: key } = this.parseString();
      this.skipWs();
      if (this.peek() !== ":") this.error("expected ':'");
      this.i++;
      const childPath = path ? `${path}.${key}` : key;
      this.parseValue(childPath, onString);
      this.skipWs();
      if (this.peek() === ",") {
        this.i++;
        continue;
      }
      if (this.peek() === "}") {
        this.i++;
        break;
      }
      this.error("expected ',' or '}'");
    }
  }

  private parseArray(path: string, onString: (s: number, e: number, v: string, p: string) => void) {
    this.i++; // [
    this.skipWs();
    if (this.peek() === "]") {
      this.i++;
      return;
    }
    let index = 0;
    while (true) {
      this.parseValue(`${path}[${index}]`, onString);
      index++;
      this.skipWs();
      if (this.peek() === ",") {
        this.i++;
        continue;
      }
      if (this.peek() === "]") {
        this.i++;
        break;
      }
      this.error("expected ',' or ']'");
    }
  }

  private parseString(): { start: number; end: number; value: string } {
    const start = this.i;
    this.i++; // opening quote
    let value = "";
    while (this.i < this.src.length && this.src[this.i] !== '"') {
      if (this.src[this.i] === "\\") {
        const next = this.src[this.i + 1];
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "/": "/" };
        value += map[next!] ?? next ?? "";
        this.i += 2;
      } else {
        value += this.src[this.i];
        this.i++;
      }
    }
    this.i++; // closing quote
    const end = this.i;
    return { start: start + 1, end: end - 1, value };
  }

  run(onString: (s: number, e: number, v: string, p: string) => void) {
    this.parseValue("", onString);
  }
}

export function extractFromJson(file: string, source: string): ExtractionResult {
  const strings: CopyString[] = [];
  const lineAt = (index: number): number => source.slice(0, index).split("\n").length;

  try {
    const scanner = new JsonScanner(source);
    scanner.run((start, end, value, path) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) return;
      strings.push({
        file,
        line: lineAt(start),
        start,
        end,
        text: value,
        kind: "json-value",
        context: path,
        quote: '"'
      });
    });
  } catch {
    return { file, originalContent: source, strings: [] };
  }

  return { file, originalContent: source, strings };
}

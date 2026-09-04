/**
 * Re-encodes a plain text value into the body of a quoted string literal,
 * escaping backslashes and the delimiting quote character. Used whenever we
 * splice a rewritten string back into source code or a JSON file.
 */
export function encodeLiteralBody(value: string, quote: '"' | "'" | "`"): string {
  let out = "";
  for (const ch of value) {
    if (ch === "\\") {
      out += "\\\\";
    } else if (ch === quote) {
      out += "\\" + quote;
    } else if (ch === "\n") {
      out += quote === "`" ? "\n" : "\\n";
    } else {
      out += ch;
    }
  }
  return out;
}

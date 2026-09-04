import { describe, it, expect } from "vitest";
import { extractFromSource } from "../src/extract/jsxExtractor.js";
import { extractFromJson } from "../src/extract/jsonExtractor.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";

describe("extractFromSource", () => {
  it("finds JSX text content", () => {
    const src = `
      export function Hello() {
        return <div>Welcome back!</div>;
      }
    `;
    const result = extractFromSource("test.tsx", src, DEFAULT_CONFIG);
    const texts = result.strings.map((s) => s.text);
    expect(texts).toContain("Welcome back!");
  });

  it("finds targeted JSX attributes only", () => {
    const src = `
      export function Form() {
        return <input placeholder="Enter your email" data-testid="email-input" />;
      }
    `;
    const result = extractFromSource("test.tsx", src, DEFAULT_CONFIG);
    const contexts = result.strings.map((s) => `${s.context}:${s.text}`);
    expect(contexts).toContain("placeholder:Enter your email");
    expect(contexts.some((c) => c.startsWith("data-testid"))).toBe(false);
  });

  it("finds call arguments for configured callees", () => {
    const src = `toast.error("Something went wrong while saving");`;
    const result = extractFromSource("test.ts", src, DEFAULT_CONFIG);
    expect(result.strings[0]?.text).toBe("Something went wrong while saving");
    expect(result.strings[0]?.context).toBe("toast.error");
  });

  it("skips short non-copy identifiers and pure punctuation", () => {
    const src = `<div className="flex gap-2">{" "}</div>;`;
    const result = extractFromSource("test.tsx", src, DEFAULT_CONFIG);
    expect(result.strings.length).toBe(0);
  });

  it("computes correct start/end offsets for JSX attribute string literals", () => {
    const src = `<button title="Save changes">Save</button>`;
    const result = extractFromSource("test.tsx", src, DEFAULT_CONFIG);
    const attr = result.strings.find((s) => s.context === "title")!;
    expect(src.slice(attr.start, attr.end)).toBe("Save changes");
  });

  it("does not crash on unparseable files", () => {
    const result = extractFromSource("broken.tsx", "this is not { valid js <<<", DEFAULT_CONFIG);
    expect(result.strings).toEqual([]);
  });
});

describe("extractFromJson", () => {
  it("finds nested string leaves with dotted paths", () => {
    const src = JSON.stringify(
      { auth: { login: { title: "Sign in to continue", button: "Log in" } } },
      null,
      2
    );
    const result = extractFromJson("en.json", src);
    const byPath = Object.fromEntries(result.strings.map((s) => [s.context, s.text]));
    expect(byPath["auth.login.title"]).toBe("Sign in to continue");
    expect(byPath["auth.login.button"]).toBe("Log in");
  });

  it("computes offsets that round-trip through the source text", () => {
    const src = `{\n  "greeting": "Hello there"\n}`;
    const result = extractFromJson("en.json", src);
    const entry = result.strings[0]!;
    expect(src.slice(entry.start, entry.end)).toBe("Hello there");
  });

  it("handles arrays of strings with indexed paths", () => {
    const src = JSON.stringify({ tips: ["First tip here", "Second tip here"] });
    const result = extractFromJson("en.json", src);
    expect(result.strings.map((s) => s.context)).toEqual(["tips[0]", "tips[1]"]);
  });
});

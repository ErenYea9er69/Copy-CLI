import { describe, it, expect } from "vitest";
import { rewriteWithRules } from "../src/rewrite/ruleEngine.js";
import { ConfigSchema } from "../src/config/schema.js";
import type { CopyString } from "../src/extract/types.js";

function makeCopy(text: string, overrides: Partial<CopyString> = {}): CopyString {
  return {
    file: "test.tsx",
    line: 1,
    start: 0,
    end: text.length,
    text,
    kind: "jsx-text",
    context: "jsx",
    ...overrides
  };
}

describe("rewriteWithRules", () => {
  it("replaces an em dash with a comma when forbidEmDash is set", () => {
    const config = ConfigSchema.parse({ style: { forbidEmDash: true } });
    const result = rewriteWithRules(makeCopy("Fast — and reliable."), config);
    expect(result.rewritten).not.toContain("—");
    expect(result.changed).toBe(true);
    expect(result.reasons.some((r) => r.includes("em dash"))).toBe(true);
  });

  it("flags banned words as violations without silently rewriting them", () => {
    const config = ConfigSchema.parse({ bannedWords: ["utilize"] });
    const result = rewriteWithRules(makeCopy("Utilize this feature to save time."), config);
    expect(result.violations.some((v) => v.includes("utilize"))).toBe(true);
  });

  it("applies preferred replacements as whole-word swaps", () => {
    const config = ConfigSchema.parse({ preferredReplacements: { customer: "user" } });
    const result = rewriteWithRules(makeCopy("Thanks for being a customer."), config);
    expect(result.rewritten).toBe("Thanks for being a user.");
    expect(result.changed).toBe(true);
  });

  it("removes a trailing filler exclamation mark for a neutral tone", () => {
    const config = ConfigSchema.parse({ brandVoice: { tone: ["direct", "confident"] } });
    const result = rewriteWithRules(makeCopy("Welcome!"), config);
    expect(result.rewritten).toBe("Welcome.");
  });

  it("keeps exclamation marks when the brand voice is playful", () => {
    const config = ConfigSchema.parse({ brandVoice: { tone: ["playful"] } });
    const result = rewriteWithRules(makeCopy("You did it!"), config);
    expect(result.rewritten).toBe("You did it!");
  });

  it("expands contractions when contractions are disallowed", () => {
    const config = ConfigSchema.parse({ brandVoice: { allowContractions: false } });
    const result = rewriteWithRules(makeCopy("You can't undo this."), config);
    expect(result.rewritten).toContain("cannot");
  });

  it("leaves contractions alone when contractions are allowed", () => {
    const config = ConfigSchema.parse({ brandVoice: { allowContractions: true } });
    const result = rewriteWithRules(makeCopy("You can't undo this."), config);
    expect(result.rewritten).toBe("You can't undo this.");
  });

  it("collapses semicolons beyond the configured max", () => {
    const config = ConfigSchema.parse({ style: { maxSemicolonsPerString: 1 } });
    const result = rewriteWithRules(
      makeCopy("Save your work; check your settings; then close the tab."),
      config
    );
    expect((result.rewritten.match(/;/g) || []).length).toBeLessThanOrEqual(1);
  });

  it("flags strings that exceed the max sentence word count", () => {
    const config = ConfigSchema.parse({ style: { maxSentenceWords: 5 } });
    const result = rewriteWithRules(makeCopy("This sentence definitely has more than five words in it"), config);
    expect(result.exceedsMaxWords).toBe(true);
    expect(result.violations.some((v) => v.includes("exceeds max sentence length"))).toBe(true);
  });

  it("trims common filler phrasing", () => {
    const config = ConfigSchema.parse({});
    const result = rewriteWithRules(makeCopy("In order to continue, please sign in."), config);
    expect(result.rewritten.toLowerCase().startsWith("to continue")).toBe(true);
  });

  it("is a no-op for already clean, on-brand copy", () => {
    const config = ConfigSchema.parse({});
    const result = rewriteWithRules(makeCopy("Save your changes"), config);
    expect(result.changed).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});

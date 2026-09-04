import type { CopyString } from "../extract/types.js";

export interface RewriteResult {
  source: CopyString;
  rewritten: string;
  changed: boolean;
  /** Fixes the engine already applied to `rewritten`. */
  reasons: string[];
  /** Problems that remain even after any automatic fixes, for lint / review. */
  violations: string[];
  exceedsMaxWords: boolean;
  engine: "rules" | "ai";
}

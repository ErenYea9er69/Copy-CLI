import type { Config } from "../config/schema.js";
import type { CopyString } from "../extract/types.js";
import type { RewriteResult } from "./types.js";
import { rewriteAllWithRules } from "./ruleEngine.js";
import { rewriteAllWithAi } from "./aiEngine.js";

export async function rewriteAll(strings: CopyString[], config: Config): Promise<RewriteResult[]> {
  if (config.rewriteMode === "ai" && config.ai.enabled) {
    return rewriteAllWithAi(strings, config);
  }
  return rewriteAllWithRules(strings, config);
}

export type { RewriteResult } from "./types.js";

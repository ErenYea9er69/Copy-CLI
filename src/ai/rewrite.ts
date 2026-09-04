import { getClient } from "./client.js";
import { buildSystemPrompt, buildUserMessage } from "./prompt.js";
import { validateRewrite } from "../rules/validator.js";
import type { Config } from "../config.js";
import type { StringCandidate, RewriteResult, RuleViolation } from "../extract/types.js";

function parseModelJson(raw: string): { rewrite: string; rationale: string } | null {
  let text = raw.trim();
  // Defensive only: the prompt forbids fences, but strip them if the model adds them anyway.
  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.rewrite === "string" && typeof parsed.rationale === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function formatFeedback(violations: RuleViolation[]): string {
  return violations.map((v) => `- ${v.rule}: ${v.detail}`).join("\n");
}

export async function rewriteCandidate(candidate: StringCandidate, config: Config): Promise<RewriteResult> {
  const client = getClient(config);
  const system = buildSystemPrompt(config);

  let feedback: string | undefined;
  let attempts = 0;
  let lastRewrite = "";
  let lastRationale = "";
  let lastErrors: RuleViolation[] = [];
  let lastWarnings: RuleViolation[] = [];

  const maxAttempts = config.max_retries + 1;

  while (attempts < maxAttempts) {
    attempts += 1;
    const userMessage = buildUserMessage(candidate, feedback);

    const text = await client.generateText(system, userMessage, config);
    const parsed = text ? parseModelJson(text) : null;

    if (!parsed) {
      lastErrors = [{ rule: "malformed-response", detail: "model did not return valid JSON", severity: "error" }];
      feedback = "Return valid JSON matching the exact shape requested, nothing else.";
      continue;
    }

    lastRewrite = parsed.rewrite;
    lastRationale = parsed.rationale;

    const { errors, warnings } = validateRewrite(
      candidate.value,
      parsed.rewrite,
      config.extra_banned_words,
      config.extra_banned_phrases
    );
    lastErrors = errors;
    lastWarnings = warnings;

    if (errors.length === 0) {
      return {
        candidate,
        rewrite: parsed.rewrite,
        rationale: parsed.rationale,
        attempts,
        status: parsed.rewrite.trim() === candidate.value.trim() ? "unchanged" : "ok",
        errors: [],
        warnings,
      };
    }

    feedback = formatFeedback(errors);
  }

  return {
    candidate,
    rewrite: lastRewrite,
    rationale: lastRationale,
    attempts,
    status: "needs_review",
    errors: lastErrors,
    warnings: lastWarnings,
  };
}

export async function rewriteCandidates(
  candidates: StringCandidate[],
  config: Config,
  onProgress?: (done: number, total: number, current: StringCandidate) => void
): Promise<RewriteResult[]> {
  const results: RewriteResult[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    onProgress?.(i, candidates.length, candidate);
    try {
      results.push(await rewriteCandidate(candidate, config));
    } catch (err: any) {
      results.push({
        candidate,
        rewrite: candidate.value,
        rationale: "",
        attempts: 0,
        status: "failed",
        errors: [{ rule: "api-error", detail: err.message ?? String(err), severity: "error" }],
        warnings: [],
      });
    }
  }
  onProgress?.(candidates.length, candidates.length, candidates[candidates.length - 1]);
  return results;
}

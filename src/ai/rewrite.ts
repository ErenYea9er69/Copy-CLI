import { getClient } from "./client.js";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildBatchSystemPrompt,
  buildBatchUserMessage,
} from "./prompt.js";
import { validateRewrite } from "../rules/validator.js";
import { inferRole } from "../rules/psychology.js";
import { clarityScore } from "../rules/score.js";
import type { Config } from "../config.js";
import type { StringCandidate, RewriteResult, RuleViolation } from "../extract/types.js";

/**
 * Resilient JSON extractor that parses JSON objects or arrays even if surrounded
 * by markdown fences, markdown commentary, or preambles.
 */
function extractJson<T>(raw: string): T | null {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function formatFeedback(violations: RuleViolation[]): string {
  return violations.map((v) => `- ${v.rule}: ${v.detail}`).join("\n");
}

export async function rewriteCandidate(
  candidate: StringCandidate,
  config: Config
): Promise<RewriteResult> {
  const client = getClient(config);
  const system = buildSystemPrompt(config);
  const role = inferRole(candidate, config);
  const scoreBefore = clarityScore(candidate.value, config.reading_level_target).score;

  let feedback: string | undefined;
  let attempts = 0;
  let lastRewrite = "";
  let lastRationale = "";
  let lastErrors: RuleViolation[] = [];
  let lastWarnings: RuleViolation[] = [];

  const maxAttempts = config.max_retries + 1;

  while (attempts < maxAttempts) {
    attempts += 1;
    const userMessage = buildUserMessage(candidate, role, feedback);

    const text = await client.generateText(system, userMessage, config);
    const parsed = text ? extractJson<{ rewrite: string; rationale: string }>(text) : null;

    if (!parsed || typeof parsed.rewrite !== "string") {
      lastErrors = [
        { rule: "malformed-response", detail: "model did not return valid JSON", severity: "error" },
      ];
      feedback = "Return a valid JSON object matching the exact shape requested, nothing else.";
      continue;
    }

    lastRewrite = parsed.rewrite;
    lastRationale = parsed.rationale || "Rewritten for clarity and brand style";

    const { errors, warnings } = validateRewrite(
      candidate.value,
      parsed.rewrite,
      config.extra_banned_words,
      config.extra_banned_phrases,
      role
    );
    lastErrors = errors;
    lastWarnings = warnings;

    if (errors.length === 0) {
      return {
        candidate,
        rewrite: parsed.rewrite,
        rationale: parsed.rationale || "Improved brand voice",
        attempts,
        status: parsed.rewrite.trim() === candidate.value.trim() ? "unchanged" : "ok",
        errors: [],
        warnings,
        role,
        scoreBefore,
        scoreAfter: clarityScore(parsed.rewrite, config.reading_level_target).score,
      };
    }

    feedback = formatFeedback(errors);
  }

  return {
    candidate,
    rewrite: lastRewrite || candidate.value,
    rationale: lastRationale || "Could not resolve all style rules",
    attempts,
    status: "needs_review",
    errors: lastErrors,
    warnings: lastWarnings,
    role,
    scoreBefore,
    scoreAfter: lastRewrite
      ? clarityScore(lastRewrite, config.reading_level_target).score
      : undefined,
  };
}

/**
 * Intelligent batch-capable rewriter for 10x faster execution in automated workflows.
 */
export async function rewriteCandidates(
  candidates: StringCandidate[],
  config: Config,
  onProgress?: (done: number, total: number, current: StringCandidate) => void
): Promise<RewriteResult[]> {
  const results: RewriteResult[] = [];
  const client = getClient(config);
  const batchSystem = buildBatchSystemPrompt(config);

  const BATCH_SIZE = 5;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const chunkWithRole = chunk.map((c) => ({
      candidate: c,
      role: inferRole(c, config),
    }));

    onProgress?.(i, candidates.length, chunk[0]);

    // Attempt high-speed batch processing first
    try {
      const userMsg = buildBatchUserMessage(chunkWithRole);
      const rawText = await client.generateText(batchSystem, userMsg, config);
      const parsedArray = rawText
        ? extractJson<Array<{ id: string; rewrite: string; rationale: string }>>(rawText)
        : null;

      if (Array.isArray(parsedArray)) {
        const parsedMap = new Map(parsedArray.map((p) => [p.id, p]));

        for (const item of chunkWithRole) {
          const found = parsedMap.get(item.candidate.id);
          if (found && typeof found.rewrite === "string") {
            const { errors, warnings } = validateRewrite(
              item.candidate.value,
              found.rewrite,
              config.extra_banned_words,
              config.extra_banned_phrases,
              item.role
            );

            if (errors.length === 0) {
              const scoreBefore = clarityScore(item.candidate.value, config.reading_level_target).score;
              const scoreAfter = clarityScore(found.rewrite, config.reading_level_target).score;
              results.push({
                candidate: item.candidate,
                rewrite: found.rewrite,
                rationale: found.rationale || "Auto-improved for brand voice",
                attempts: 1,
                status: found.rewrite.trim() === item.candidate.value.trim() ? "unchanged" : "ok",
                errors: [],
                warnings,
                role: item.role,
                scoreBefore,
                scoreAfter,
              });
              continue;
            }
          }

          // If individual chunk item failed validation, fallback to single rewrite with retries
          results.push(await rewriteCandidate(item.candidate, config));
        }
        continue;
      }
    } catch {
      // If batch call fails, fallback to serial single-candidate processing for this chunk
    }

    for (const item of chunkWithRole) {
      try {
        results.push(await rewriteCandidate(item.candidate, config));
      } catch (err: any) {
        results.push({
          candidate: item.candidate,
          rewrite: item.candidate.value,
          rationale: "",
          attempts: 0,
          status: "failed",
          errors: [{ rule: "api-error", detail: err.message ?? String(err), severity: "error" }],
          warnings: [],
        });
      }
    }
  }

  onProgress?.(candidates.length, candidates.length, candidates[candidates.length - 1]);
  return results;
}

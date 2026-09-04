import type { Config } from "../config/schema.js";
import type { CopyString } from "../extract/types.js";
import type { RewriteResult } from "./types.js";
import { rewriteWithRules } from "./ruleEngine.js";

interface BatchItem {
  id: number;
  text: string;
  context: string;
  kind: string;
}

function buildSystemPrompt(config: Config): string {
  return [
    "You rewrite user interface copy for a software product.",
    `Audience: ${config.audience}`,
    `Product goals: ${config.goals.join("; ")}`,
    `Brand voice tone: ${config.brandVoice.tone.join(", ")}`,
    `Formality: ${config.brandVoice.formality}`,
    `Point of view: ${config.brandVoice.person} person`,
    `Contractions allowed: ${config.brandVoice.allowContractions}`,
    `Max words per string: ${config.style.maxSentenceWords}`,
    "Rules: keep every rewrite accurate to the original meaning. Do not invent new claims or features.",
    "Keep placeholders like {name} or %s exactly as they appear. Keep punctuation used for interpolation.",
    "Return ONLY a JSON array of objects: [{\"id\": number, \"rewritten\": string}]. No prose, no markdown fences."
  ].join("\n");
}

async function callAnthropic(config: Config, items: BatchItem[]): Promise<Map<number, string>> {
  const apiKey = process.env[config.ai.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `AI rewrite mode is enabled but ${config.ai.apiKeyEnv} is not set in the environment.`
    );
  }

  const userPrompt = JSON.stringify(
    items.map((i) => ({ id: i.id, text: i.text, context: i.context, kind: i.kind })),
    null,
    2
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.ai.model,
      max_tokens: 4096,
      temperature: config.ai.temperature,
      system: buildSystemPrompt(config),
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text")?.text ?? "[]";
  const cleaned = textBlock.replace(/^```json\s*|\s*```$/g, "").trim();

  let parsed: Array<{ id: number; rewritten: string }>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI engine returned a non-JSON response: ${textBlock.slice(0, 200)}`);
  }

  const map = new Map<number, string>();
  for (const entry of parsed) {
    if (typeof entry.id === "number" && typeof entry.rewritten === "string") {
      map.set(entry.id, entry.rewritten);
    }
  }
  return map;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function rewriteAllWithAi(
  strings: CopyString[],
  config: Config
): Promise<RewriteResult[]> {
  if (strings.length === 0) return [];

  const items: BatchItem[] = strings.map((s, id) => ({
    id,
    text: s.text,
    context: s.context,
    kind: s.kind
  }));

  const batches = chunk(items, config.ai.maxStringsPerBatch);
  const results = new Map<number, string>();

  for (const batch of batches) {
    try {
      const batchResult = await callAnthropic(config, batch);
      for (const [id, rewritten] of batchResult) results.set(id, rewritten);
    } catch (err) {
      // Fail this batch closed: fall back to the deterministic rule engine
      // for these strings rather than aborting the whole run.
      for (const item of batch) {
        const source = strings[item.id]!;
        const ruleResult = rewriteWithRules(source, config);
        results.set(item.id, ruleResult.rewritten);
      }
      process.stderr.write(
        `[copyshed] AI engine batch failed, fell back to rules for ${batch.length} string(s): ${
          (err as Error).message
        }\n`
      );
    }
  }

  return strings.map((source, id) => {
    const rewritten = results.get(id) ?? source.text;
    const wordCount = rewritten.trim().split(/\s+/).filter(Boolean).length;
    const exceedsMaxWords = wordCount > config.style.maxSentenceWords;
    return {
      source,
      rewritten,
      changed: rewritten !== source.text,
      reasons: rewritten !== source.text ? ["rewritten by AI engine to match brand voice"] : [],
      violations: exceedsMaxWords
        ? [`exceeds max sentence length (${wordCount} > ${config.style.maxSentenceWords} words)`]
        : [],
      exceedsMaxWords,
      engine: "ai" as const
    };
  });
}

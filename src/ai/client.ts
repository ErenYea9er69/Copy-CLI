import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";

export interface AIClient {
  generateText(system: string, userMessage: string, config: Config): Promise<string | null>;
}

class AnthropicClient implements AIClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(system: string, userMessage: string, config: Config): Promise<string | null> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 500,
      temperature: config.temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock ? textBlock.text : null;
  }
}

class OpenAICompatibleClient implements AIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateText(system: string, userMessage: string, config: Config): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage }
        ],
        temperature: config.temperature,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return data?.choices?.[0]?.message?.content || null;
  }
}

let clientInstance: AIClient | null = null;

export function getClient(config: Config): AIClient {
  if (clientInstance) return clientInstance;

  const model = config.model.toLowerCase();

  // Route to the correct provider based on the model name prefix
  if (model.startsWith("claude")) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    clientInstance = new AnthropicClient(apiKey);
  } else if (model.startsWith("gpt") || model.startsWith("o1")) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.openai.com/v1");
  } else if (model.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://generativelanguage.googleapis.com/v1beta/openai");
  } else if (model.startsWith("grok")) {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("XAI_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.x.ai/v1");
  } else if (model.startsWith("moonshot")) {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.moonshot.cn/v1");
  } else if (model.startsWith("deepseek")) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.deepseek.com");
  } else if (model.startsWith("mistral")) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.mistral.ai/v1");
  } else if (model.includes("llama") || model.includes("groq")) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.groq.com/openai/v1");
  } else if (model.startsWith("pplx") || model.startsWith("sonar")) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://api.perplexity.ai");
  } else {
    // Default to OpenAI compatible if not recognized
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    if (!apiKey) throw new Error(`Unknown model '${config.model}'. Set OPENAI_API_KEY and optionally OPENAI_BASE_URL to use as an OpenAI-compatible endpoint, or use a known prefix (gpt, claude, gemini, grok, etc).`);
    clientInstance = new OpenAICompatibleClient(apiKey, baseUrl);
  }

  return clientInstance;
}

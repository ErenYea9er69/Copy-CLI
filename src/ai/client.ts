import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";

export interface AIClient {
  generateText(system: string, userMessage: string, config: Config): Promise<string | null>;
  generateChat(system: string, messages: { role: "user" | "assistant"; content: string }[], config: Config): Promise<string | null>;
}

class AnthropicClient implements AIClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(system: string, userMessage: string, config: Config): Promise<string | null> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 1500,
      temperature: config.temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock ? textBlock.text : null;
  }

  async generateChat(system: string, messages: { role: "user" | "assistant"; content: string }[], config: Config): Promise<string | null> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 1500,
      temperature: config.temperature,
      system,
      messages,
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
    return this.generateChat(system, [{ role: "user", content: userMessage }], config);
  }

  async generateChat(system: string, messages: { role: "user" | "assistant"; content: string }[], config: Config): Promise<string | null> {
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
          ...messages
        ],
        temperature: config.temperature,
        max_tokens: 1500
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

  if (model.startsWith("claude")) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    clientInstance = new AnthropicClient(apiKey);
  } else if (model.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    clientInstance = new OpenAICompatibleClient(apiKey, "https://generativelanguage.googleapis.com/v1beta/openai");
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    if (!apiKey) throw new Error(`Unknown model '${config.model}'. Set OPENAI_API_KEY.`);
    clientInstance = new OpenAICompatibleClient(apiKey, baseUrl);
  }

  return clientInstance;
}

import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../config.js";

export interface AIClient {
  providerName: string;
  activeModel: string;
  generateText(system: string, userMessage: string, config: Config): Promise<string | null>;
  generateChat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    config: Config
  ): Promise<string | null>;
}

class AnthropicClient implements AIClient {
  private client: Anthropic;
  providerName = "Anthropic Claude";
  activeModel: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    // Normalize model name
    this.activeModel = model.includes("sonnet") ? "claude-3-5-sonnet-20241022" : model;
  }

  async generateText(system: string, userMessage: string, config: Config): Promise<string | null> {
    const response = await this.client.messages.create({
      model: this.activeModel,
      max_tokens: 2000,
      temperature: config.temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock ? textBlock.text : null;
  }

  async generateChat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    config: Config
  ): Promise<string | null> {
    const response = await this.client.messages.create({
      model: this.activeModel,
      max_tokens: 2000,
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
  providerName: string;
  activeModel: string;

  constructor(apiKey: string, baseUrl: string, providerName: string, model: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.providerName = providerName;
    this.activeModel = model;
  }

  async generateText(system: string, userMessage: string, config: Config): Promise<string | null> {
    return this.generateChat(system, [{ role: "user", content: userMessage }], config);
  }

  async generateChat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    config: Config
  ): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.activeModel,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: config.temperature,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${this.providerName} API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    return data?.choices?.[0]?.message?.content || null;
  }
}

let clientInstance: AIClient | null = null;

/**
 * Intelligent client resolver with zero-config multi-provider auto-detection.
 * Automatically matches available environment API keys to appropriate endpoints.
 */
export function getClient(config: Config): AIClient {
  if (clientInstance) return clientInstance;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  const configuredModel = (config.model || "").toLowerCase();

  // 1. Explicit Anthropic match or auto-fallback
  if (
    anthropicKey &&
    (configuredModel.includes("claude") || (!geminiKey && !openaiKey && !groqKey && !deepseekKey))
  ) {
    const model = configuredModel.includes("claude") ? config.model : "claude-3-5-sonnet-20241022";
    clientInstance = new AnthropicClient(anthropicKey, model);
    return clientInstance;
  }

  // 2. Google Gemini match or auto-fallback
  if (geminiKey && (configuredModel.includes("gemini") || !anthropicKey)) {
    const model = configuredModel.includes("gemini") ? config.model : "gemini-2.0-flash";
    clientInstance = new OpenAICompatibleClient(
      geminiKey,
      "https://generativelanguage.googleapis.com/v1beta/openai",
      "Google Gemini",
      model
    );
    return clientInstance;
  }

  // 3. OpenAI match or auto-fallback
  if (openaiKey && (configuredModel.includes("gpt") || (!anthropicKey && !geminiKey))) {
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = configuredModel.includes("gpt") ? config.model : "gpt-4o-mini";
    clientInstance = new OpenAICompatibleClient(openaiKey, baseUrl, "OpenAI", model);
    return clientInstance;
  }

  // 4. Groq match
  if (groqKey) {
    const model = configuredModel.includes("llama") ? config.model : "llama-3.3-70b-versatile";
    clientInstance = new OpenAICompatibleClient(groqKey, "https://api.groq.com/openai/v1", "Groq", model);
    return clientInstance;
  }

  // 5. DeepSeek match
  if (deepseekKey) {
    const model = "deepseek-chat";
    clientInstance = new OpenAICompatibleClient(deepseekKey, "https://api.deepseek.com/v1", "DeepSeek", model);
    return clientInstance;
  }

  // 6. Generic Anthropic fallback if key present
  if (anthropicKey) {
    clientInstance = new AnthropicClient(anthropicKey, "claude-3-5-sonnet-20241022");
    return clientInstance;
  }

  throw new Error(
    "No AI API key found. Please set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your .env file."
  );
}

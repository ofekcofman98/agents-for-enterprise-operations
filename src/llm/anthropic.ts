import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "./client.js";

export class AnthropicClient implements LlmClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content[0];
    return block?.type === "text" ? block.text : "";
  }
}

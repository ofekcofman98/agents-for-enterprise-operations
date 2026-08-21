/**
 * Everything the orchestrator/agents need from an LLM, kept tiny and
 * text-in/text-out so the real Anthropic client and the deterministic fake
 * are interchangeable — tests and offline demos run against the fake.
 */
export interface LlmClient {
  /** One-shot completion. systemPrompt sets behavior; returns raw text. */
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

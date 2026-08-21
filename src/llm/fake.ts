import type { LlmClient } from "./client.js";
import { AGENTS, AGENT_NAMES } from "../agents/registry.js";

/**
 * Deterministic, offline stand-in for the real model. Used by default when
 * ANTHROPIC_API_KEY is unset, and by all tests so they never depend on
 * network access or model non-determinism. Recognizes the two prompt shapes
 * the app actually sends (router classification, contact-update extraction)
 * via simple keyword rules and returns the same JSON contract the real
 * client is instructed to produce. Routing keywords come from
 * src/agents/registry.ts — never hardcoded here — so a new agent is
 * classifiable offline without touching this file.
 */
export class FakeLlmClient implements LlmClient {
  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const text = userPrompt.toLowerCase();

    if (systemPrompt.includes("ROUTER_TASK")) {
      return JSON.stringify(routeByKeyword(text));
    }

    if (systemPrompt.includes("CONTACT_EXTRACT_TASK")) {
      return JSON.stringify(extractContactUpdate(userPrompt));
    }

    return "I'm not sure how to help with that.";
  }
}

function routeByKeyword(text: string) {
  const hits = AGENT_NAMES.filter((name) => AGENTS[name].keywords.test(text));

  if (hits.length === 0) {
    const options = AGENT_NAMES.map((name) => AGENTS[name].description).join(" ");
    return {
      decision: "clarify",
      confidence: 0.2,
      reason: "no recognizable intent keywords",
      clarifyingQuestion: `I can help with: ${options} — which one do you need?`,
    };
  }
  if (hits.length > 1) {
    return {
      decision: "clarify",
      confidence: 0.4,
      reason: "multiple possible intents detected",
      clarifyingQuestion: `Just to confirm — which of these did you mean: ${hits.join(", ")}?`,
    };
  }
  return { decision: hits[0], confidence: 0.9, reason: `${hits[0]} keyword matched` };
}

function extractContactUpdate(text: string) {
  const phoneMatch = text.match(/(\+?\d[\d-]{7,}\d)/);
  const isAddress = /address|כתובת|street|st\.|st\b/i.test(text);
  const isPhone = /phone|טלפון/i.test(text) || Boolean(phoneMatch);

  if (isPhone && phoneMatch) {
    return { field: "phone", newValue: phoneMatch[1] };
  }
  if (isAddress) {
    const afterTo = text.split(/\bto\b/i)[1];
    return { field: "address", newValue: afterTo ? afterTo.trim() : text.trim() };
  }
  return { field: null, newValue: null };
}

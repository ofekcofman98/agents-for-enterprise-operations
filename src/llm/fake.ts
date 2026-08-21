import type { LlmClient } from "./client.js";

/**
 * Deterministic, offline stand-in for the real model. Used by default when
 * ANTHROPIC_API_KEY is unset, and by all tests so they never depend on
 * network access or model non-determinism. Recognizes the two prompt shapes
 * the app actually sends (router classification, contact-update extraction)
 * via simple keyword rules and returns the same JSON contract the real
 * client is instructed to produce.
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
  const hasBalance = /balance|how much (money|do i have)|יתרה/.test(text);
  const hasLoan = /loan|הלוואה/.test(text);
  const hasContact = /phone|address|update.*(contact|details)|טלפון|כתובת|עדכ(ן|ון)/.test(text);

  const hits = [hasBalance, hasLoan, hasContact].filter(Boolean).length;

  if (hits === 0) {
    return {
      decision: "clarify",
      confidence: 0.2,
      reason: "no recognizable intent keywords",
      clarifyingQuestion:
        "I can help with account balance, loan status, or updating your contact details — which one do you need?",
    };
  }
  if (hits > 1) {
    return {
      decision: "clarify",
      confidence: 0.4,
      reason: "multiple possible intents detected",
      clarifyingQuestion: "Just to confirm — is this about your balance, your loan, or your contact details?",
    };
  }
  if (hasBalance) return { decision: "BalanceAgent", confidence: 0.9, reason: "balance keyword matched" };
  if (hasLoan) return { decision: "LoanStatusAgent", confidence: 0.9, reason: "loan keyword matched" };
  return { decision: "ContactUpdateAgent", confidence: 0.9, reason: "contact update keyword matched" };
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

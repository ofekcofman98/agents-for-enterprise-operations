import type { LlmClient } from "../llm/client.js";
import type { AgentName, RouterResult as RouterResultT } from "./intents.js";
import { ROUTING_CONFIDENCE_THRESHOLD } from "./intents.js";
import { classify } from "./classifier.js";
import { AGENTS } from "../agents/registry.js";
import type { AgentResult, DispatchDeps } from "../agents/types.js";
import { trace } from "../obs/trace.js";

/**
 * Deterministic policy over the classifier's raw opinion: the LLM's decision
 * never routes on its own if it falls below ROUTING_CONFIDENCE_THRESHOLD — it
 * is downgraded to "clarify" here, in code. This is the "ambiguity -> ask,
 * don't guess" requirement enforced outside the model, and is unit-testable
 * without an LLM.
 */
export function applyRoutingPolicy(raw: RouterResultT): RouterResultT {
  if (raw.decision === "clarify" || raw.decision === "refuse") return raw;
  if (raw.confidence >= ROUTING_CONFIDENCE_THRESHOLD) return raw;

  return {
    decision: "clarify",
    confidence: raw.confidence,
    reason: `below confidence threshold (${raw.confidence} < ${ROUTING_CONFIDENCE_THRESHOLD}): ${raw.reason}`,
    clarifyingQuestion: "I want to make sure I route this correctly — could you tell me a bit more about what you need?",
  };
}

/** Classifies a turn and applies the confidence policy, tracing the final decision. */
export async function route(
  llm: LlmClient,
  userInput: string,
  ctx: { traceId: string; turnId: string },
): Promise<RouterResultT> {
  const raw = await classify(llm, userInput);
  const decision = applyRoutingPolicy(raw);

  trace({
    type: "router.decision",
    traceId: ctx.traceId,
    turnId: ctx.turnId,
    decision: decision.decision,
    confidence: decision.confidence,
    reason: decision.reason,
  });

  return decision;
}

/** Runs the registered handler for a routed agent name — see src/agents/registry.ts. */
export function dispatch(name: AgentName, deps: DispatchDeps): Promise<AgentResult> {
  return AGENTS[name].run(deps);
}

import type { LlmClient } from "../llm/client.js";
import type { Session } from "../session.js";
import type { AgentName, RouterResult as RouterResultT } from "./intents.js";
import { ROUTING_CONFIDENCE_THRESHOLD } from "./intents.js";
import { classify } from "./classifier.js";
import { runBalanceAgent } from "../agents/balanceAgent.js";
import { runLoanStatusAgent } from "../agents/loanStatusAgent.js";
import { runContactUpdateAgent } from "../agents/contactUpdateAgent.js";
import type { AgentResult, AgentContext } from "../agents/types.js";
import { trace } from "../obs/trace.js";

/** Everything an agent handler might need, in one uniform shape. */
export interface DispatchDeps {
  llm: LlmClient;
  session: Session;
  input: string;
  ctx: AgentContext;
}

type AgentHandler = (deps: DispatchDeps) => Promise<AgentResult>;

/**
 * One entry per AgentName is enforced by the Record type — omitting an agent
 * here is a compile error, not a silent fall-through. This is the actual
 * routing table; classify()/applyRoutingPolicy() only decide which key to use.
 */
export const AGENT_HANDLERS: Record<AgentName, AgentHandler> = {
  BalanceAgent: async ({ session, ctx }) => runBalanceAgent(session, ctx),
  LoanStatusAgent: async ({ session, ctx }) => runLoanStatusAgent(session, ctx),
  ContactUpdateAgent: async ({ llm, input, ctx }) => runContactUpdateAgent(llm, input, ctx),
}; // ? is it modular? Is it easy to add a new agent in minimal changes and places?

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

/** Runs the handler for a routed agent name. */
export function dispatch(
  name: AgentName, 
  deps: DispatchDeps
): Promise<AgentResult> {
  return AGENT_HANDLERS[name](deps);
}

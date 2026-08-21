import { z } from "zod";

/**
 * The fixed set of things the orchestrator can decide to do with a turn.
 * This is data, not prose — the router LLM call is constrained to return one
 * of these values (or "clarify" / "refuse"), and everything downstream
 * switches on it deterministically.
 */
export const AgentName = z.enum([
  "BalanceAgent",
  "LoanStatusAgent",
  "ContactUpdateAgent",
]);
export type AgentName = z.infer<typeof AgentName>;

export const RoutingDecision = z.enum([...AgentName.options, "clarify", "refuse"]);
export type RoutingDecision = z.infer<typeof RoutingDecision>;

export const RouterResult = z.object({
  decision: RoutingDecision,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  /** Only present when decision === "clarify" */
  clarifyingQuestion: z.string().optional(),
});
export type RouterResult = z.infer<typeof RouterResult>;

/** Minimum confidence to route straight to an agent instead of clarifying. */
export const ROUTING_CONFIDENCE_THRESHOLD = 0.6;

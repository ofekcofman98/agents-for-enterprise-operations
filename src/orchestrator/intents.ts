import { z } from "zod";
import { AGENT_NAMES } from "../agents/registry.js";
import type { AgentName as AgentNameT } from "../agents/registry.js";

/**
 * The fixed set of things the orchestrator can decide to do with a turn.
 * This is data, not prose — the router LLM call is constrained to return one
 * of these values (or "clarify" / "refuse"), and everything downstream
 * switches on it deterministically. The set of agent names is NOT restated
 * here: it's derived from src/agents/registry.ts, the single source of truth.
 */
export const AgentName = z.enum(AGENT_NAMES as [AgentNameT, ...AgentNameT[]]);
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

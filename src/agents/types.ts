import type { PendingProposal, Session } from "../session.js";
import type { LlmClient } from "../llm/client.js";

/** What a sub-agent hands back to the orchestrator. Never a raw string. */
export type AgentResult =
  | { kind: "say"; text: string }
  | { kind: "askClarify"; question: string }
  | { kind: "proposeWrite"; proposal: Omit<PendingProposal, "token" | "createdAt" | "status"> }
  | { kind: "refuse"; reason: string };

export interface AgentContext {
  customerId: string;
  traceId: string;
  turnId: string;
}

/** Everything an agent handler might need, in one uniform shape. */
export interface DispatchDeps {
  llm: LlmClient;
  session: Session;
  input: string;
  ctx: AgentContext;
}

/**
 * One entry per agent in src/agents/registry.ts — the single source of truth
 * for the agent set. `description` feeds the classifier prompt; `keywords`
 * feeds the offline FakeLlmClient. See src/agents/CLAUDE.md.
 */
export interface AgentDefinition {
  description: string;
  keywords: RegExp;
  run: (deps: DispatchDeps) => Promise<AgentResult>;
}

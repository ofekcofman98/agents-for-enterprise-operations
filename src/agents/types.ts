import type { PendingProposal } from "../session.js";

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

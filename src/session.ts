import { randomUUID } from "node:crypto";

export interface PendingProposal {
  /** sha256 hash binding this token to the exact {tool, args} payload — see tools/invoke.ts */
  token: string;
  tool: string;
  args: Record<string, unknown>;
  /** Human-readable summary shown to the user for confirmation. */
  question: string;
  createdAt: number;
  status: "awaiting" | "confirmed";
}

/** A confirmed write must execute within this window of proposal creation. */
export const PROPOSAL_TTL_MS = 5 * 60_000;

export function isProposalExpired(proposal: PendingProposal, now: number = Date.now()): boolean {
  return now - proposal.createdAt > PROPOSAL_TTL_MS;
}

export interface AwaitingClarification {
  originalQuery: string;
  question: string;
  askedAt: number;
}

export interface Session {
  id: string;
  customerId: string;
  language: "he" | "en";
  /** At most one write proposal may be live at a time; a new one supersedes the old. */
  pendingProposal: PendingProposal | null;
  /** Set when the router asked a clarifying question instead of routing. */
  awaitingClarification: AwaitingClarification | null;
  history: Array<{ role: "user" | "agent"; text: string; turnId: string }>;
}

export function createSession(customerId: string, language: Session["language"] = "en"): Session {
  return {
    id: randomUUID(),
    customerId,
    language,
    pendingProposal: null,
    awaitingClarification: null,
    history: [],
  };
}

/** Replaces any existing proposal — traced by the caller so the supersession is visible. */
export function setPendingProposal(session: Session, proposal: PendingProposal): void {
  session.pendingProposal = proposal;
}

export function clearPendingProposal(session: Session): void {
  session.pendingProposal = null;
}

export function setAwaitingClarification(session: Session, value: AwaitingClarification | null): void {
  session.awaitingClarification = value;
}

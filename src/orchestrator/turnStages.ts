import type { Session } from "../session.js";
import { clearPendingProposal, setAwaitingClarification, isProposalExpired } from "../session.js";
import { checkInjection } from "../guards/injection.js";
import { parseConfirmation } from "../guards/confirmation.js";
import { invokeTool, WriteBlockedError } from "../tools/invoke.js";
import { trace } from "../obs/trace.js";

/** A pipeline stage either resolves the turn (`done: true`, with the reply to
 * send) or lets it fall through to the next stage, optionally rewriting the
 * effective input (used by clarificationStage to splice in the resumed query). */
export type StageOutcome = { 
  done: true; 
  reply: string 
} | { 
  done: false; 
  input: string 
};

interface StageArgs {
  session: Session;
  input: string;
  traceId: string;
  turnId: string;
}

const fallThrough = (input: string): StageOutcome => ({ done: false, input });
const resolved = (reply: string): StageOutcome => ({ done: true, reply });

/** Precedence stage 1: block anything that looks like a prompt injection before
 * anything else runs. */
export function injectionStage(
  { input, traceId, turnId }: StageArgs
): StageOutcome {
  const injection = checkInjection(input);
  trace({ type: "injection.check", traceId, turnId, flagged: injection.flagged, reason: injection.reason });
  if (!injection.flagged) return fallThrough(input);

  return resolved("I can't do that. I can help with your balance, loan status, or updating your contact details.");
}

/** Precedence stage 2: a write awaiting yes/no takes priority over fresh routing.
 * An expired proposal is cleared and treated as if none were pending, so a late
 * "yes" doesn't silently re-propose a stale change. */
export function writeConfirmationStage(
  { session, input, traceId, turnId }: StageArgs
): StageOutcome {
  const proposal = session.pendingProposal;
  if (!proposal || proposal.status !== "awaiting") return fallThrough(input);

  if (isProposalExpired(proposal)) {
    const staleTool = proposal.tool;
    clearPendingProposal(session);
    trace({ type: "write.blocked", traceId, turnId, tool: staleTool, reason: "confirmation token expired" });
    return fallThrough(input);
  }

  const confirmation = parseConfirmation(input);
  trace({ type: "confirmation.parsed", traceId, turnId, result: confirmation });

  if (confirmation === "confirm") {
    session.pendingProposal = { ...proposal, status: "confirmed" };
    try {
      invokeTool(proposal.tool, { ...proposal.args, confirmationToken: proposal.token }, session, { traceId, turnId });
      return resolved("Done — your contact details have been updated.");
    } catch (err) {
      clearPendingProposal(session);
      return resolved(
        err instanceof WriteBlockedError
          ? "I couldn't complete that update — the confirmation didn't match. Please ask again."
          : "Something went wrong applying that update. Please try again.",
      );
    }
  }

  if (confirmation === "deny") {
    clearPendingProposal(session);
    return resolved("No problem, I've cancelled that change.");
  }

  // unclear: re-ask, leave proposal untouched
  return resolved(`Sorry, I need a yes or no. ${proposal.question}`);
}

/** Precedence stage 3: an outstanding clarifying question means this turn is the
 * answer, not a fresh request — resume the original query rather than re-route
 * the bare answer on its own. */
export function clarificationStage({ session, input, traceId, turnId }: StageArgs): StageOutcome {
  if (!session.awaitingClarification) return fallThrough(input);

  const { originalQuery, question } = session.awaitingClarification;
  trace({ type: "clarification.resumed", traceId, turnId, originalQuery, answer: input });
  setAwaitingClarification(session, null);
  return fallThrough(`${originalQuery} (clarification: ${question} -> ${input})`);
}

/** Precedence order — normative, see root CLAUDE.md. Changing this order is an
 * architectural change, not a refactor. */
export const STAGES = [injectionStage, writeConfirmationStage, clarificationStage];

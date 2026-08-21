import type { Session, PendingProposal } from "../session.js";
import { setPendingProposal, setAwaitingClarification } from "../session.js";
import { hashProposal } from "../tools/proposalToken.js";
import { trace } from "../obs/trace.js";
import type { AgentResult, AgentContext } from "../agents/types.js";

/** Turns an AgentResult into a reply, mutating session state as needed. This is
 * the only place a `kind` becomes a spoken reply or touches pendingProposal /
 * awaitingClarification (see src/agents/CLAUDE.md). */
export async function applyAgentResult(
  session: Session,
  result: AgentResult,
  ctx: AgentContext,
): Promise<string> {
  switch (result.kind) {
    case "say":
      return result.text;
    case "refuse":
      return `I can't do that: ${result.reason}`;
    case "askClarify":
      setAwaitingClarification(session, { originalQuery: "", question: result.question, askedAt: Date.now() });
      trace({ type: "clarification.asked", traceId: ctx.traceId, turnId: ctx.turnId, question: result.question });
      return result.question;
    case "proposeWrite": {
      const nonce = Date.now();
      const token = hashProposal(result.proposal.tool, result.proposal.args, session.id, nonce);
      const oldToken = session.pendingProposal?.token;
      const proposal: PendingProposal = { ...result.proposal, token, createdAt: nonce, status: "awaiting" };
      setPendingProposal(session, proposal);
      if (oldToken) {
        trace({ type: "proposal.superseded", traceId: ctx.traceId, turnId: ctx.turnId, oldToken, newToken: token });
      }
      trace({
        type: "proposal.created",
        traceId: ctx.traceId,
        turnId: ctx.turnId,
        tool: proposal.tool,
        args: proposal.args,
        token,
      });
      return proposal.question;
    }
  }
}

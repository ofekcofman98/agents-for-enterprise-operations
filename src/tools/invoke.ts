import { getTool } from "./registry.js";
import { trace } from "../obs/trace.js";
import type { Session } from "../session.js";
import { clearPendingProposal, isProposalExpired } from "../session.js";
import { hashProposal } from "./proposalToken.js";

export class WriteBlockedError extends Error {}

/**
 * The ONE place any tool is executed. This is the line to point at for
 * "show me where a write cannot happen without confirmation": a caller
 * cannot reach a write tool's handler except through this function, and
 * this function throws unless every condition below holds.
 */
export function invokeTool(
  toolName: string,
  args: Record<string, unknown>,
  session: Session,
  ctx: { traceId: string; turnId: string },
): unknown {
  const tool = getTool(toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  const parsed = tool.schema.parse(args); // zod: bad/hallucinated args never reach a handler

  if (!tool.readOnly) {
    const proposal = session.pendingProposal;
    const reject = (reason: string) => {
      trace({ type: "write.blocked", traceId: ctx.traceId, turnId: ctx.turnId, tool: toolName, reason });
      throw new WriteBlockedError(reason);
    };

    if (!proposal) return reject("no pending proposal for this session");
    if (proposal.status !== "confirmed") return reject("pending proposal has not been confirmed");
    if (isProposalExpired(proposal)) {
      // Stale token: clear it so it can't be retried, then refuse.
      clearPendingProposal(session);
      return reject("confirmation token expired");
    }
    if (proposal.tool !== toolName) return reject("confirmed proposal is for a different tool");

    const suppliedToken = (parsed as { confirmationToken?: string }).confirmationToken;
    if (!suppliedToken || suppliedToken !== proposal.token) {
      return reject("confirmation token missing or does not match the pending proposal");
    }

    // Re-hash the args actually being executed against the token: guarantees
    // the confirmed write is byte-for-byte the one the user was shown and
    // said yes to, not a payload swapped in after confirmation.
    const recomputed = hashProposal(toolName, args, session.id, proposal.createdAt);
    if (recomputed !== proposal.token) {
      return reject("tool args do not match the confirmed proposal payload");
    }

    // Single-use: consume the token before executing, regardless of outcome.
    clearPendingProposal(session);
  }

  trace({ type: "tool.call", traceId: ctx.traceId, turnId: ctx.turnId, tool: toolName, args: parsed, readOnly: tool.readOnly });
  const start = Date.now();
  try {
    const result = tool.handler(parsed);
    trace({ type: "tool.result", traceId: ctx.traceId, turnId: ctx.turnId, tool: toolName, ok: true, durationMs: Date.now() - start, result });
    return result;
  } catch (err) {
    trace({ type: "tool.result", traceId: ctx.traceId, turnId: ctx.turnId, tool: toolName, ok: false, durationMs: Date.now() - start, error: String(err) });
    throw err;
  }
}

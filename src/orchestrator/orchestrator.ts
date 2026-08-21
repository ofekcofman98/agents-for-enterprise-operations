import { randomUUID } from "node:crypto";
import type { LlmClient } from "../llm/client.js";
import type { Session } from "../session.js";
import { setAwaitingClarification } from "../session.js";
import { route, dispatch } from "./router.js";
import { applyAgentResult } from "./applyAgentResult.js";
import { STAGES } from "./turnStages.js";
import { trace } from "../obs/trace.js";
import type { AgentContext } from "../agents/types.js";

/**
 * Handles exactly one user turn against a session. Precedence, in order, is
 * the STAGES list in turnStages.ts (injection -> pending write confirmation ->
 * pending clarification); the first stage that resolves the turn wins. If no
 * stage resolves it, the (possibly rewritten, e.g. by a resumed clarification)
 * input is routed and dispatched fresh. This order is normative — see root
 * CLAUDE.md — changing it is an architectural change, not a refactor.
 */
export async function handleTurn( // ? error handling?
  llm: LlmClient,
  session: Session,
  userInput: string,
): Promise<string> {
  const traceId = session.id;
  const turnId = randomUUID();
  const ctx: AgentContext = { customerId: session.customerId, traceId, turnId };

  trace({ type: "turn.start", traceId, turnId, sessionId: session.id, input: userInput });

  let reply: string;
  let effectiveInput = userInput;

  const stageResult = runStages(session, effectiveInput, traceId, turnId);
  if (stageResult.done) {
    reply = stageResult.reply;
  } else {
    effectiveInput = stageResult.input;
    reply = await routeAndDispatch(llm, session, effectiveInput, ctx);
  }

  trace({ type: "turn.end", traceId, turnId, reply });
  return reply;
}

function runStages(
  session: Session, 
  input: string, 
  traceId: string, 
  turnId: string
) {
  let current = input;
  for (const stage of STAGES) {
    const outcome = stage({ session, input: current, traceId, turnId });
    if (outcome.done) return outcome;
    current = outcome.input;
  }
  return { done: false as const, input: current };
}

async function routeAndDispatch(
  llm: LlmClient,
  session: Session,
  input: string,
  ctx: AgentContext,
): Promise<string> {
  const decision = await route(llm, input, { traceId: ctx.traceId, turnId: ctx.turnId });

  if (decision.decision === "refuse") {
    return "I'm not able to help with that request. I can assist with your balance, loan status, or contact details.";
  }

  if (decision.decision === "clarify") {
    const question = decision.clarifyingQuestion ?? "Could you clarify what you need help with?";
    setAwaitingClarification(session, { originalQuery: input, question, askedAt: Date.now() });
    trace({ type: "clarification.asked", traceId: ctx.traceId, turnId: ctx.turnId, question });
    return question;
  }

  const result = await dispatch(decision.decision, { llm, session, input, ctx });
  return applyAgentResult(session, result, ctx);
}

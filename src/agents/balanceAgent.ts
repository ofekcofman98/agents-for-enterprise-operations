import type { AgentResult, AgentContext } from "./types.js";
import { invokeTool } from "../tools/invoke.js";
import type { Session } from "../session.js";
import type { Account } from "../db/mockDb.js";

export function runBalanceAgent(session: Session, ctx: AgentContext): AgentResult {
  const account = invokeTool("getBalance", { customerId: ctx.customerId }, session, ctx) as Account;
  return {
    kind: "say",
    text: `Your account balance is ${account.balance.toFixed(2)} ${account.currency}.`,
  };
}

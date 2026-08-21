import type { AgentResult, AgentContext } from "./types.js";
import { invokeTool } from "../tools/invoke.js";
import type { Session } from "../session.js";
import type { Loan } from "../db/mockDb.js";

export function runLoanStatusAgent(session: Session, ctx: AgentContext): AgentResult {
  const loan = invokeTool("getLoanStatus", { customerId: ctx.customerId }, session, ctx) as Loan;
  return {
    kind: "say",
    text: `Your loan application (${loan.loanId}) for ${loan.amount} is currently: ${loan.status}.`,
  };
}

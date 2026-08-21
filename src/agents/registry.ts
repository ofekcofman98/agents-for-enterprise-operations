import type { AgentDefinition } from "./types.js";
import { runBalanceAgent } from "./balanceAgent.js";
import { runLoanStatusAgent } from "./loanStatusAgent.js";
import { runContactUpdateAgent } from "./contactUpdateAgent.js";

/**
 * The single source of truth for the agent set. Everything else that needs to
 * know "what agents exist" — the routing schema (intents.ts), the classifier
 * prompt (classifier.ts), the offline FakeLlmClient (llm/fake.ts), and
 * dispatch (router.ts) — derives from this object rather than restating the
 * name. Adding an agent is: write the handler, add one entry here. See
 * src/agents/CLAUDE.md.
 */
export const AGENTS = {
  BalanceAgent: {
    description: "Account balance questions — how much money is in the account.",
    keywords: /balance|how much (money|do i have)|יתרה/,
    run: async ({ session, ctx }) => runBalanceAgent(session, ctx),
  },
  LoanStatusAgent: {
    description: "Loan application status questions.",
    keywords: /loan|הלוואה/,
    run: async ({ session, ctx }) => runLoanStatusAgent(session, ctx),
  },
  ContactUpdateAgent: {
    description: "Updating contact details — phone number or address (write, propose-only).",
    keywords: /phone|address|update.*(contact|details)|טלפון|כתובת|עדכ(ן|ון)/,
    run: async ({ llm, input, ctx }) => runContactUpdateAgent(llm, input, ctx),
  },
} as const satisfies Record<string, AgentDefinition>;

export type AgentName = keyof typeof AGENTS;
export const AGENT_NAMES = Object.keys(AGENTS) as AgentName[];

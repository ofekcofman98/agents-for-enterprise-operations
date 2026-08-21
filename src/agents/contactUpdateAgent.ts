import type { AgentResult, AgentContext } from "./types.js";
import type { LlmClient } from "../llm/client.js";
import { getCustomer } from "../db/mockDb.js";

const EXTRACT_SYSTEM_PROMPT = `CONTACT_EXTRACT_TASK
Extract the requested contact field update from the user's message. Respond
with ONLY JSON of this exact shape, no prose:
{"field": "phone" | "address" | null, "newValue": "<string>" | null}
Use null for both if you cannot confidently determine the field or new value.`;

/**
 * ContactUpdateAgent NEVER calls a write tool. It has no import of
 * tools/bank.writeTools.ts and no access to invoke.ts for writes — its only
 * possible outputs are "say"/"askClarify"/"refuse", or "proposeWrite", which
 * the orchestrator turns into a pending proposal that requires a separate,
 * explicit user confirmation before tools/invoke.ts will execute anything.
 */
export async function runContactUpdateAgent(
  llm: LlmClient,
  userInput: string,
  ctx: AgentContext,
): Promise<AgentResult> {
  const raw = await llm.complete(EXTRACT_SYSTEM_PROMPT, userInput);

  let extracted: { field: "phone" | "address" | null; newValue: string | null };
  try {
    extracted = JSON.parse(raw);
  } catch {
    extracted = { field: null, newValue: null };
  }

  if (!extracted.field || !extracted.newValue) {
    return {
      kind: "askClarify",
      question: "What would you like to update — your phone number or your address — and to what new value?",
    };
  }

  const customer = getCustomer(ctx.customerId);
  if (!customer) {
    return { kind: "refuse", reason: "customer record not found" };
  }

  const oldValue = customer[extracted.field];

  return {
    kind: "proposeWrite",
    proposal: {
      tool: "updateContact",
      args: { customerId: ctx.customerId, field: extracted.field, newValue: extracted.newValue },
      question: `I'll update your ${extracted.field} from "${oldValue}" to "${extracted.newValue}". Shall I go ahead?`,
    },
  };
}

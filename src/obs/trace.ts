import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LOG_PATH = "logs/trace.jsonl";

export type TraceEvent =
  | { type: "turn.start"; traceId: string; turnId: string; sessionId: string; input: string }
  | { type: "injection.check"; traceId: string; turnId: string; flagged: boolean; reason?: string }
  | { type: "router.decision"; traceId: string; turnId: string; decision: string; confidence: number; reason: string }
  | { type: "clarification.asked"; traceId: string; turnId: string; question: string }
  | { type: "clarification.resumed"; traceId: string; turnId: string; originalQuery: string; answer: string }
  | { type: "proposal.created"; traceId: string; turnId: string; tool: string; args: unknown; token: string }
  | { type: "proposal.superseded"; traceId: string; turnId: string; oldToken: string; newToken: string }
  | { type: "confirmation.parsed"; traceId: string; turnId: string; result: "confirm" | "deny" | "unclear" }
  | { type: "tool.call"; traceId: string; turnId: string; tool: string; args: unknown; readOnly: boolean }
  | { type: "tool.result"; traceId: string; turnId: string; tool: string; ok: boolean; durationMs: number; result?: unknown; error?: string }
  | { type: "write.blocked"; traceId: string; turnId: string; tool: string; reason: string }
  | { type: "turn.error"; traceId: string; turnId: string; message: string }
  | { type: "turn.end"; traceId: string; turnId: string; reply: string };

let dirEnsured = false;

/** Single choke point for all observability: one JSONL file replays a whole conversation. */
export function trace(event: TraceEvent): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  if (!dirEnsured) {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    dirEnsured = true;
  }
  try {
    appendFileSync(LOG_PATH, line + "\n", "utf8");
  } catch {
    // best-effort file logging; never let tracing break a turn
  }
  // eslint-disable-next-line no-console
  console.log(`[trace] ${line}`);
}

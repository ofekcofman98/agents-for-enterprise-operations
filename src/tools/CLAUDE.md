# src/tools — Choke Point & Write Gate

## Choke point invariant

`invokeTool` in `invoke.ts` is the only place any tool handler runs. Never export or call a
tool's `handler` directly, and never let an agent or orchestrator code reach into
`src/db/mockDb.ts` — every read and every write goes through `invokeTool`, which validates args
against the tool's `zod` schema, enforces the write gate below for `readOnly: false` tools, and
traces the call (`tool.call` / `tool.result`).

## Write gate — the five conditions

A `readOnly: false` tool executes only if **all** of these hold; any failure throws
`WriteBlockedError` after a `write.blocked` trace, and never silently no-ops:

1. `session.pendingProposal` exists.
2. `pendingProposal.status === "confirmed"`.
3. The proposal is **unexpired**: `!isProposalExpired(proposal)` (`PROPOSAL_TTL_MS` in
   `src/session.ts`, currently 5 minutes from `createdAt`). An expired proposal is cleared
   before rejecting, so it cannot be retried.
4. `pendingProposal.tool === toolName`, and the supplied `confirmationToken` equals
   `pendingProposal.token`.
5. Re-hashing the args actually being executed (`hashProposal(toolName, args, sessionId,
   proposal.createdAt)`) reproduces that same token — this is what stops a payload swapped in
   after confirmation from executing under a still-valid token.

The token is then **single-use**: `clearPendingProposal` runs before the handler executes,
regardless of outcome. A new proposal always supersedes an unconfirmed one (traced as
`proposal.superseded`), invalidating its token.

**This file is the audited boundary.** Any change to the conditions above requires a
corresponding case in `tests/guardrail.test.ts` (see the existing bypass-attempt tests: missing
proposal, unconfirmed, forged token, payload swap, replay, expired, superseded/stale token) —
do not weaken or reorder these checks without adding a test that would have failed before the
change.

## Tool definitions

- Register every tool via `registerTool` (`registry.ts`) with a strict `zod` schema — no
  `z.any()`, no `.passthrough()`. Validation (`tool.schema.parse`) happens before the write gate,
  so malformed or hallucinated args from the LLM never reach a handler.
  See `bank.readTools.ts` / `bank.writeTools.ts` for the pattern.
- Write-tool schemas must require `confirmationToken: z.string().min(1)` as part of the schema
  itself (belt-and-suspenders with the gate's own token check in `invoke.ts`).
- `hashProposal` (`proposalToken.ts`) deliberately excludes `confirmationToken` from the hashed
  payload — it doesn't exist yet when the proposal is created. Do not add it back into the
  hashed fields; doing so would make the token unrecomputable at confirmation time.
